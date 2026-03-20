"""Worker Stack: ECS Fargate cluster for running Scrapy workers."""
import os
import aws_cdk as cdk
from aws_cdk import (
    aws_ecs as ecs,
    aws_ec2 as ec2,
    aws_iam as iam,
    aws_logs as logs,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    aws_sqs as sqs,
    CfnOutput,
)
from constructs import Construct


class WorkerStack(cdk.Stack):
    """ECS Fargate cluster running Scrapy + Playwright workers."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        data_bucket: s3.Bucket,
        job_queue: sqs.Queue,
        jobs_table: dynamodb.Table,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── VPC ──
        vpc = ec2.Vpc(
            self,
            "WorkerVpc",
            max_azs=2,
            nat_gateways=1,
        )

        # ── ECS Cluster ──
        self.cluster = ecs.Cluster(
            self,
            "WorkerCluster",
            cluster_name="spiderflow-workers",
            vpc=vpc,
            container_insights=True,
        )

        # ── Log Group ──
        log_group = logs.LogGroup(
            self,
            "WorkerLogs",
            log_group_name="/spiderflow/workers",
            retention=logs.RetentionDays.TWO_WEEKS,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        # ── Task Definition ──
        task_def = ecs.FargateTaskDefinition(
            self,
            "WorkerTask",
            family="spiderflow-worker",
            cpu=1024,       # 1 vCPU
            memory_limit_mib=2048,  # 2 GB
        )

        task_def.add_container(
            "WorkerContainer",
            image=ecs.ContainerImage.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "worker")
            ),
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix="worker",
                log_group=log_group,
            ),
            environment={
                "JOB_QUEUE_URL": job_queue.queue_url,
                "DATA_BUCKET": data_bucket.bucket_name,
                "JOBS_TABLE": jobs_table.table_name,
            },
        )

        # ── IAM Permissions ──
        data_bucket.grant_read_write(task_def.task_role)
        job_queue.grant_consume_messages(task_def.task_role)
        jobs_table.grant_read_write_data(task_def.task_role)

        # ── Store references ──
        self.task_definition = task_def

        # ── Outputs ──
        CfnOutput(self, "ClusterArn", value=self.cluster.cluster_arn)
        CfnOutput(self, "TaskDefinitionArn", value=task_def.task_definition_arn)
