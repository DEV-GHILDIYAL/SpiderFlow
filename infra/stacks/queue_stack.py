"""Queue Stack: SQS queue for scraping job distribution."""
import aws_cdk as cdk
from aws_cdk import (
    aws_sqs as sqs,
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
            queue_name="spiderflow-jobs-dlq",
            retention_period=cdk.Duration.days(14),
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

        # ── Outputs ──
        CfnOutput(self, "JobQueueUrl", value=self.job_queue.queue_url)
        CfnOutput(self, "JobQueueArn", value=self.job_queue.queue_arn)
        CfnOutput(self, "DLQUrl", value=dlq.queue_url)
