#!/usr/bin/env python3
"""SpiderFlow CDK Application Entry Point."""
import os
import aws_cdk as cdk

from stacks.cognito_stack import CognitoStack
from stacks.storage_stack import StorageStack
from stacks.queue_stack import QueueStack
from stacks.api_stack import ApiStack
from stacks.worker_stack import WorkerStack

app = cdk.App()

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

app.synth()
