#!/usr/bin/env python3
"""SpiderFlow CDK Application Entry Point."""
import os
import aws_cdk as cdk

from stacks.cognito_stack import CognitoStack
from stacks.storage_stack import StorageStack
from stacks.queue_stack import QueueStack
from stacks.api_stack import ApiStack
from stacks.worker_stack import WorkerStack
from stacks.scheduler_stack import SchedulerStack
from stacks.waf_stack import WafStack

app = cdk.App()

# Default execution environment
env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=os.environ.get("CDK_DEFAULT_REGION", "us-east-1"),
)

# Core infrastructure stacks
cognito_stack = CognitoStack(app, "SpiderFlowCognito", env=env)
storage_stack = StorageStack(app, "SpiderFlowStorage", env=env)
queue_stack = QueueStack(app, "SpiderFlowQueue", env=env)

# API stack depends on cognito, storage, and queue
api_stack = ApiStack(
    app,
    "SpiderFlowApi",
    env=env,
    user_pool=cognito_stack.user_pool,
    sessions_table=storage_stack.sessions_table,
    jobs_table=storage_stack.jobs_table,
    data_bucket=storage_stack.data_bucket,
    job_queue=queue_stack.job_queue,
)
api_stack.add_dependency(cognito_stack)
api_stack.add_dependency(storage_stack)
api_stack.add_dependency(queue_stack)

# Worker stack depends on storage and queue
worker_stack = WorkerStack(
    app,
    "SpiderFlowWorker",
    env=env,
    data_bucket=storage_stack.data_bucket,
    job_queue=queue_stack.job_queue,
    jobs_table=storage_stack.jobs_table,
)
worker_stack.add_dependency(storage_stack)
worker_stack.add_dependency(queue_stack)

# Scheduler stack triggers jobs periodically
scheduler_stack = SchedulerStack(
    app,
    "SpiderFlowScheduler",
    env=env,
    job_queue_url=queue_stack.job_queue.queue_url,
    job_queue_arn=queue_stack.job_queue.queue_arn,
    sessions_table_name=storage_stack.sessions_table.table_name,
    jobs_table_name=storage_stack.jobs_table.table_name,
)
scheduler_stack.add_dependency(storage_stack)
scheduler_stack.add_dependency(queue_stack)


# ── WAF Stack ──

# Ensure CloudFront WebACL is deployed in us-east-1
waf_env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region="us-east-1"
)

# Safely construct the exact API Gateway ARN required for regional associations
# Format: arn:aws:apigateway:{region}::/restapis/{rest_api_id}/stages/{stage_name}
api_stage_arn = f"arn:aws:apigateway:{env.region}::/restapis/{api_stack.api.rest_api_id}/stages/{api_stack.api.deployment_stage.stage_name}"

# Given frontend_stack doesn't natively exist tracked via CDK (uses GitHub Actions CloudFront), fall back to ENV string
cloudfront_distribution_id = os.environ.get("CLOUDFRONT_DISTRIBUTION_ID", "PROVIDED_BY_GITHUB_ACTIONS")

waf_stack = WafStack(
    app,
    "SpiderFlowWaf",
    env=waf_env,
    api_gateway_arn=api_stage_arn,
    cloudfront_distribution_id=cloudfront_distribution_id
)

waf_stack.add_dependency(api_stack)
# waf_stack.add_dependency(frontend_stack) # Omitted because frontend_stack does not exist natively in this project.

app.synth()
