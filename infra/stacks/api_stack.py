"""API Stack: API Gateway + Lambda functions for SpiderFlow backend."""
import os
import aws_cdk as cdk
from aws_cdk import (
    aws_apigateway as apigw,
    aws_lambda as _lambda,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    aws_sqs as sqs,
    CfnOutput,
)
from constructs import Construct


class ApiStack(cdk.Stack):
    """REST API backed by Lambda functions, secured with Cognito."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        user_pool: cognito.UserPool,
        sessions_table: dynamodb.Table,
        jobs_table: dynamodb.Table,
        users_table: dynamodb.Table,
        data_bucket: s3.Bucket,
        job_queue: sqs.Queue,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Shared Lambda Layer ──
        shared_layer = _lambda.LayerVersion(
            self,
            "SharedLayer",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "backend", "layers", "shared")
            ),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_12],
            description="Shared utilities for SpiderFlow Lambdas",
        )

        # ── Common environment variables ──
        common_env = {
            "SESSIONS_TABLE": sessions_table.table_name,
            "JOBS_TABLE": jobs_table.table_name,
            "USERS_TABLE": users_table.table_name,
            "DATA_BUCKET": data_bucket.bucket_name,
            "JOB_QUEUE_URL": job_queue.queue_url,
        }

        # ── Lambda: Sessions Handler ──
        sessions_fn = _lambda.Function(
            self,
            "SessionsHandler",
            function_name="spiderflow-sessions",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "backend", "functions", "sessions")
            ),
            layers=[shared_layer],
            environment=common_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=256,
        )
        sessions_table.grant_read_write_data(sessions_fn)

        # ── Lambda: Jobs Handler ──
        jobs_fn = _lambda.Function(
            self,
            "JobsHandler",
            function_name="spiderflow-jobs",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "backend", "functions", "jobs")
            ),
            layers=[shared_layer],
            environment=common_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=256,
        )
        jobs_table.grant_read_write_data(jobs_fn)
        users_table.grant_read_write_data(jobs_fn)
        job_queue.grant_send_messages(jobs_fn)

        # ── Lambda: Dashboard / Metrics Handler ──
        dashboard_fn = _lambda.Function(
            self,
            "DashboardHandler",
            function_name="spiderflow-dashboard",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "backend", "functions", "dashboard")
            ),
            layers=[shared_layer],
            environment=common_env,
            timeout=cdk.Duration.seconds(30),
            memory_size=256,
        )
        sessions_table.grant_read_data(dashboard_fn)
        jobs_table.grant_read_data(dashboard_fn)
        data_bucket.grant_read(dashboard_fn)

        # ── Lambda: Data Export Handler ──
        export_fn = _lambda.Function(
            self,
            "ExportHandler",
            function_name="spiderflow-export",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "backend", "functions", "export")
            ),
            layers=[shared_layer],
            environment={
                **common_env,
                "SCRAPED_DATA_BUCKET": data_bucket.bucket_name
            },
            timeout=cdk.Duration.seconds(60),
            memory_size=512,
        )
        # Upgraded to read/write for CSV PUT uploads + GeneratePresignedUrl
        data_bucket.grant_read_write(export_fn)
        jobs_table.grant_read_data(export_fn)

        # ── Lambda: Users Handler (SaaS Control) ──
        users_fn = _lambda.Function(
            self,
            "UsersHandler",
            function_name="spiderflow-users",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(
                os.path.join(os.path.dirname(__file__), "..", "..", "backend", "functions", "users")
            ),
            layers=[shared_layer],
            environment=common_env,
            timeout=cdk.Duration.seconds(20),
            memory_size=256,
        )
        users_table.grant_read_write_data(users_fn)

        # ── API Gateway ──
        self.api = apigw.RestApi(
            self,
            "SpiderFlowApi",
            rest_api_name="SpiderFlow API",
            description="SpiderFlow Cloud Scraping Platform API",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        # Cognito Authorizer
        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "CognitoAuthorizer",
            cognito_user_pools=[user_pool],
        )
        # /sessions
        sessions_resource = self.api.root.add_resource("sessions")
        sessions_resource.add_method("GET", apigw.LambdaIntegration(sessions_fn),
                                     authorizer=authorizer,
                                     authorization_type=apigw.AuthorizationType.COGNITO)
        sessions_resource.add_method("POST", apigw.LambdaIntegration(sessions_fn),
                                     authorizer=authorizer,
                                     authorization_type=apigw.AuthorizationType.COGNITO)

        session_item = sessions_resource.add_resource("{sessionId}")
        session_item.add_method("GET", apigw.LambdaIntegration(sessions_fn),
                                authorizer=authorizer,
                                authorization_type=apigw.AuthorizationType.COGNITO)
        session_item.add_method("PUT", apigw.LambdaIntegration(sessions_fn),
                                authorizer=authorizer,
                                authorization_type=apigw.AuthorizationType.COGNITO)
        session_item.add_method("DELETE", apigw.LambdaIntegration(sessions_fn),
                                authorizer=authorizer,
                                authorization_type=apigw.AuthorizationType.COGNITO)

        # /jobs
        jobs_resource = self.api.root.add_resource("jobs")
        jobs_resource.add_method("GET", apigw.LambdaIntegration(jobs_fn),
                                 authorizer=authorizer,
                                 authorization_type=apigw.AuthorizationType.COGNITO)
        jobs_resource.add_method("POST", apigw.LambdaIntegration(jobs_fn),
                                 authorizer=authorizer,
                                 authorization_type=apigw.AuthorizationType.COGNITO)

        job_item = jobs_resource.add_resource("{jobId}")
        job_item.add_method("GET", apigw.LambdaIntegration(jobs_fn),
                            authorizer=authorizer,
                            authorization_type=apigw.AuthorizationType.COGNITO)

        # /dashboard
        dashboard_resource = self.api.root.add_resource("dashboard")
        dashboard_resource.add_method("GET", apigw.LambdaIntegration(dashboard_fn),
                                      authorizer=authorizer,
                                      authorization_type=apigw.AuthorizationType.COGNITO)

        # /export
        export_resource = self.api.root.add_resource("export")
        export_resource.add_method("GET", apigw.LambdaIntegration(export_fn),
                                   authorizer=authorizer,
                                   authorization_type=apigw.AuthorizationType.COGNITO)

        # /users
        users_resource = self.api.root.add_resource("users")
        me_resource = users_resource.add_resource("me")
        me_resource.add_method("GET", apigw.LambdaIntegration(users_fn),
                               authorizer=authorizer,
                               authorization_type=apigw.AuthorizationType.COGNITO)
        
        reset_usage_resource = me_resource.add_resource("reset-usage")
        reset_usage_resource.add_method("POST", apigw.LambdaIntegration(users_fn),
                                        authorizer=authorizer,
                                        authorization_type=apigw.AuthorizationType.COGNITO)

        # ── Outputs ──
        CfnOutput(self, "ApiUrl", value=self.api.url)
