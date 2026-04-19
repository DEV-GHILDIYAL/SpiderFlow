"""API Stack: API Gateway + Lambda functions for SpiderFlow SaaS."""
import os
import aws_cdk as cdk
from aws_cdk import (
    aws_apigateway as apigw,
    aws_lambda as _lambda,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    aws_sqs as sqs,
    aws_kms as kms,
    CfnOutput,
)
from constructs import Construct


class ApiStack(cdk.Stack):
    """REST API for SpiderFlow SaaS, secured with Cognito and KMS."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        user_pool: cognito.UserPool,
        rooms_table: dynamodb.Table,
        jobs_table: dynamodb.Table,
        users_table: dynamodb.Table,
        data_bucket: s3.Bucket,
        job_queue: sqs.Queue,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Encryption Key (KMS) ──
        self.encryption_key = kms.Key(
            self,
            "SpiderFlowKey",
            description="Key for encrypting user API keys and MongoDB URIs",
            enable_key_rotation=True,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        # ── Shared Lambda Layer ──
        shared_layer = _lambda.LayerVersion(
            self,
            "SharedLayer",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "backend", "layers", "shared")
            ),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_12],
        )

        # ── Common environment variables ──
        common_env = {
            "ROOMS_TABLE": rooms_table.table_name,
            "JOBS_TABLE": jobs_table.table_name,
            "USERS_TABLE": users_table.table_name,
            "DATA_BUCKET": data_bucket.bucket_name,
            "JOB_QUEUE_URL": job_queue.queue_url,
            "KMS_KEY_ID": self.encryption_key.key_id,
        }

        # ── Lambda Handlers ──

        def create_handler(id, name, path, env_extra={}):
            fn = _lambda.Function(
                self,
                id,
                function_name=f"spiderflow-{name}",
                runtime=_lambda.Runtime.PYTHON_3_12,
                handler="handler.lambda_handler",
                code=_lambda.Code.from_asset(
                    os.path.join(os.path.dirname(__file__), "..", "..", "backend", "functions", path)
                ),
                layers=[shared_layer],
                environment={**common_env, **env_extra},
                timeout=cdk.Duration.seconds(30),
            )
            return fn

        rooms_fn = create_handler("RoomsHandler", "rooms", "rooms")
        jobs_fn = create_handler("JobsHandler", "jobs", "jobs")
        users_fn = create_handler("UsersHandler", "users", "users")
        billing_fn = create_handler("BillingHandler", "billing", "billing")

        # Permissions
        rooms_table.grant_read_write_data(rooms_fn)
        self.encryption_key.grant_encrypt_decrypt(rooms_fn)

        jobs_table.grant_read_write_data(jobs_fn)
        rooms_table.grant_read_data(jobs_fn)
        users_table.grant_read_write_data(jobs_fn)
        job_queue.grant_send_messages(jobs_fn)

        users_table.grant_read_write_data(users_fn)
        
        users_table.grant_read_write_data(billing_fn)

        # ── API Gateway ──
        self.api = apigw.RestApi(
            self,
            "SpiderFlowApi",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self, "CognitoAuthorizer", cognito_user_pools=[user_pool]
        )
        auth_opts = {
            "authorizer": authorizer,
            "authorization_type": apigw.AuthorizationType.COGNITO,
        }

        # Routes: /users
        user_res = self.api.root.add_resource("users")
        me_res = user_res.add_resource("me")
        me_res.add_method("GET", apigw.LambdaIntegration(users_fn), **auth_opts)
        me_res.add_resource("init").add_method("POST", apigw.LambdaIntegration(users_fn), **auth_opts)

        # Routes: /rooms
        rooms_res = self.api.root.add_resource("rooms")
        rooms_res.add_method("GET", apigw.LambdaIntegration(rooms_fn), **auth_opts)
        rooms_res.add_method("POST", apigw.LambdaIntegration(rooms_fn), **auth_opts)

        room_item = rooms_res.add_resource("{roomId}")
        room_item.add_method("GET", apigw.LambdaIntegration(rooms_fn), **auth_opts)
        room_item.add_method("PUT", apigw.LambdaIntegration(rooms_fn), **auth_opts)
        room_item.add_method("DELETE", apigw.LambdaIntegration(rooms_fn), **auth_opts)
        room_item.add_resource("verify-mongo").add_method("POST", apigw.LambdaIntegration(rooms_fn), **auth_opts)

        # Routes: /rooms/{roomId}/jobs
        jobs_res = room_item.add_resource("jobs")
        jobs_res.add_method("GET", apigw.LambdaIntegration(jobs_fn), **auth_opts)
        jobs_res.add_method("POST", apigw.LambdaIntegration(jobs_fn), **auth_opts)
        
        job_item = jobs_res.add_resource("{jobId}")
        job_item.add_method("GET", apigw.LambdaIntegration(jobs_fn), **auth_opts)

        # Routes: /billing
        billing_res = self.api.root.add_resource("billing")
        billing_res.add_resource("create-order").add_method("POST", apigw.LambdaIntegration(billing_fn), **auth_opts)
        billing_res.add_resource("verify-payment").add_method("POST", apigw.LambdaIntegration(billing_fn), **auth_opts)

        CfnOutput(self, "ApiUrl", value=self.api.url)
        CfnOutput(self, "KmsKeyId", value=self.encryption_key.key_id)
