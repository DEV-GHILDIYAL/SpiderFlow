"""Jobs Lambda Handler – Trigger scraping jobs via SQS."""
import json
import os
import uuid

import boto3
from boto3.dynamodb.conditions import Key

from shared.utils import build_response, get_user_id, now_iso

dynamodb = boto3.resource("dynamodb")
jobs_table = dynamodb.Table(os.environ["JOBS_TABLE"])
sqs = boto3.client("sqs")
QUEUE_URL = os.environ["JOB_QUEUE_URL"]


def lambda_handler(event, context):
    """Route requests to job operations."""
    http_method = event["httpMethod"]
    path_params = event.get("pathParameters") or {}
    job_id = path_params.get("jobId")

    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    try:
        if http_method == "POST":
            body = json.loads(event.get("body") or "{}")
            return trigger_job(user_id, body)
        elif http_method == "GET":
            if job_id:
                return get_job(job_id)
            else:
                return list_jobs(user_id)
        else:
            return build_response(405, {"error": "Method not allowed"})
    except Exception as e:
        print(f"Error: {e}")
        return build_response(500, {"error": "Internal server error"})


def list_jobs(user_id: str):
    """List all jobs for a user using UserJobsIndex GSI."""
    response = jobs_table.query(
        IndexName="UserJobsIndex",
        KeyConditionExpression=Key("userId").eq(user_id),
        ScanIndexForward=False,  # Newest first
    )
    return build_response(200, response.get("Items", []))


def trigger_job(user_id: str, body: dict):
    """Create a new scraping job and publish to SQS."""
    session_id = body.get("sessionId")
    if not session_id:
        return build_response(400, {"error": "sessionId is required"})

    job_id = str(uuid.uuid4())
    now = now_iso()

    job_item = {
        "sessionId": session_id,
        "jobId": job_id,
        "userId": user_id,
        "status": "queued",
        "createdAt": now,
        "updatedAt": now,
        "pagesScraped": 0,
        "itemsExtracted": 0,
        "errors": [],
    }

    # Save job record to DynamoDB
    jobs_table.put_item(Item=job_item)

    # Publish message to SQS
    sqs_params = {
        "QueueUrl": QUEUE_URL,
        "MessageBody": json.dumps({
            "jobId": job_id,
            "sessionId": session_id,
            "userId": user_id,
        })
    }
    
    if ".fifo" in QUEUE_URL:
        sqs_params["MessageGroupId"] = session_id
        
    sqs.send_message(**sqs_params)

    return build_response(201, job_item)


def get_job(job_id: str):
    """Get job status and details. Scans for simplicity – could be improved with GSI."""
    # We use the StatusIndex GSI or scan; for now, scan by jobId
    response = jobs_table.scan(
        FilterExpression="jobId = :jid",
        ExpressionAttributeValues={":jid": job_id},
    )
    items = response.get("Items", [])
    if not items:
        return build_response(404, {"error": "Job not found"})
    return build_response(200, items[0])
