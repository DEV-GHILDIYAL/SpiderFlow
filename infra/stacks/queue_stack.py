"""Queue Stack: SQS queue for scraping job distribution."""
import aws_cdk as cdk
from aws_cdk import (
    aws_sqs as sqs,
    aws_sns as sns,
    aws_cloudwatch as cw,
    aws_cloudwatch_actions as cw_actions,
    CfnOutput,
)
from constructs import Construct


class QueueStack(cdk.Stack):
    """SQS queue that distributes scraping jobs to ECS workers."""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Dead Letter Queue ──
        dlq = sqs.Queue(
            self,
            "JobDLQ",
            queue_name="SpiderFlowDLQ",
            retention_period=cdk.Duration.days(14),
            encryption=sqs.QueueEncryption.SQS_MANAGED,
        )

        # ── Main Job Queue ──
        self.job_queue = sqs.Queue(
            self,
            "JobQueue",
            queue_name="spiderflow-jobs",
            visibility_timeout=cdk.Duration.minutes(15),
            retention_period=cdk.Duration.days(4),
            dead_letter_queue=sqs.DeadLetterQueue(
                max_receive_count=3,
                queue=dlq,
            ),
        )

        # ── SNS Topic ──
        dlq_alarm_topic = sns.Topic(
            self,
            "DLQAlarmTopic",
            topic_name="SpiderFlowDLQAlarm",
        )

        # ── CloudWatch Alarm ──
        dlq_alarm = cw.Alarm(
            self,
            "DLQMessageAlarm",
            alarm_name="SpiderFlowDLQ-MessageAlert",
            metric=dlq.metric_approximate_number_of_messages_visible(),
            threshold=1,
            evaluation_periods=1,
            comparison_operator=cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        )
        dlq_alarm.add_alarm_action(cw_actions.SnsAction(dlq_alarm_topic))

        # ── Outputs ──
        CfnOutput(self, "JobQueueUrl", value=self.job_queue.queue_url)
        CfnOutput(self, "JobQueueArn", value=self.job_queue.queue_arn)
        CfnOutput(self, "DLQUrl", value=dlq.queue_url)
        CfnOutput(self, "DLQAlarmTopicArn", value=dlq_alarm_topic.topic_arn)
