"""Scheduler Stack: AWS EventBridge Scheduler for automated job triggers."""
import os
import aws_cdk as cdk
from aws_cdk import (
    aws_iam as iam,
    aws_lambda as _lambda,
    aws_scheduler as scheduler,
    CfnOutput
)
from constructs import Construct

class SchedulerStack(cdk.Stack):
    """EventBridge Scheduler driving recurring scraping jobs."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        job_queue_url: str,
        job_queue_arn: str,
        sessions_table_name: str,
        jobs_table_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Lambda Function ──
        trigger_fn = _lambda.Function(
            self,
            "SchedulerTriggerFn",
            function_name="SpiderFlowSchedulerTrigger",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "backend", "functions", "scheduler")
            ),
            environment={
                "JOB_QUEUE_URL": job_queue_url,
                "SESSIONS_TABLE": sessions_table_name,
                "JOBS_TABLE": jobs_table_name,
            },
            timeout=cdk.Duration.minutes(2),
            memory_size=256
        )

        # ── Lambda IAM Permissions ──
        trigger_fn.add_to_role_policy(iam.PolicyStatement(
            actions=["dynamodb:Scan", "dynamodb:Query", "dynamodb:GetItem"],
            resources=[f"arn:aws:dynamodb:{self.region}:{self.account}:table/{sessions_table_name}"]
        ))
        trigger_fn.add_to_role_policy(iam.PolicyStatement(
            actions=["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:BatchWriteItem"],
            resources=[f"arn:aws:dynamodb:{self.region}:{self.account}:table/{jobs_table_name}"]
        ))
        trigger_fn.add_to_role_policy(iam.PolicyStatement(
            actions=["sqs:SendMessage"],
            resources=[job_queue_arn]
        ))

        # ── Scheduler IAM Role ──
        scheduler_role = iam.Role(
            self,
            "SchedulerRole",
            role_name="SpiderFlowSchedulerRole",
            assumed_by=iam.ServicePrincipal("scheduler.amazonaws.com")
        )
        # Permission to invoke the Lambda
        scheduler_role.add_to_policy(iam.PolicyStatement(
            actions=["lambda:InvokeFunction"],
            resources=[trigger_fn.function_arn]
        ))
        # Additional permission per requirements: Send messages to the main SQS JobsQueue
        scheduler_role.add_to_policy(iam.PolicyStatement(
            actions=["sqs:SendMessage"],
            resources=[job_queue_arn]
        ))

        # ── EventBridge Schedule ──
        schedule = scheduler.CfnSchedule(
            self,
            "SpiderFlowDailySchedule",
            name="SpiderFlowDailySchedule",
            # Runs every day at 00:00 UTC
            schedule_expression="cron(0 0 * * ? *)",
            flexible_time_window=scheduler.CfnSchedule.FlexibleTimeWindowProperty(mode="OFF"),
            target=scheduler.CfnSchedule.TargetProperty(
                arn=trigger_fn.function_arn,
                role_arn=scheduler_role.role_arn,
                retry_policy=scheduler.CfnSchedule.RetryPolicyProperty(
                    maximum_retry_attempts=2
                )
            )
        )

        # ── Outputs ──
        CfnOutput(self, "SchedulerLambdaArn", value=trigger_fn.function_arn)
        CfnOutput(self, "ScheduleName", value=schedule.name)
