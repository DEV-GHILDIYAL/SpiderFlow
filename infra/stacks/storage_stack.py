"""Storage Stack: DynamoDB tables and S3 buckets for SpiderFlow SaaS."""
import aws_cdk as cdk
from aws_cdk import (
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    CfnOutput,
)
from constructs import Construct


class StorageStack(cdk.Stack):
    """DynamoDB tables and S3 buckets for rooms, jobs, and user profiles."""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Users Table (Subscription & Usage) ──
        self.users_table = dynamodb.Table(
            self,
            "UsersTable",
            table_name="SpiderFlowUsers",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        # ── Rooms Table (Replacing Sessions) ──
        self.rooms_table = dynamodb.Table(
            self,
            "RoomsTable",
            table_name="SpiderFlowRooms",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="roomId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        # ── Jobs Table (Room-scoped) ──
        # Partition Key updated to roomId as per SAAS requirements
        self.jobs_table = dynamodb.Table(
            self,
            "JobsTable",
            table_name="SpiderFlowJobs",
            partition_key=dynamodb.Attribute(
                name="roomId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="jobId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )
        # GSI remains for admin/overview queries if needed
        self.jobs_table.add_global_secondary_index(
            index_name="UserJobsIndex",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="createdAt", type=dynamodb.AttributeType.STRING
            ),
        )

        # ── Data Bucket (stores scraped results) ──
        self.data_bucket = s3.Bucket(
            self,
            "DataBucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=cdk.Duration.days(90),
                    transitions=[
                        s3.Transition(
                            storage_class=s3.StorageClass.INFREQUENT_ACCESS,
                            transition_after=cdk.Duration.days(30),
                        )
                    ],
                )
            ],
        )

        # ── Frontend Hosting Bucket ──
        self.frontend_bucket = s3.Bucket(
            self,
            "FrontendBucket",
            website_index_document="index.html",
            website_error_document="index.html",
            public_read_access=True,
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=False,
                block_public_policy=False,
                ignore_public_acls=False,
                restrict_public_buckets=False
            ),
            removal_policy=cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # ── Outputs ──
        CfnOutput(self, "UsersTableName", value=self.users_table.table_name)
        CfnOutput(self, "RoomsTableName", value=self.rooms_table.table_name)
        CfnOutput(self, "JobsTableName", value=self.jobs_table.table_name)
        CfnOutput(self, "DataBucketName", value=self.data_bucket.bucket_name)
        CfnOutput(self, "FrontendUrl", value=self.frontend_bucket.bucket_website_url)
