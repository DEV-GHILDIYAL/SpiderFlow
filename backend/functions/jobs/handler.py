"""Jobs Lambda Handler – Trigger scraping jobs via SQS."""
import json
import os
import uuid

import boto3
from boto3.dynamodb.conditions import Key

from shared.utils import build_response, get_user_id, now_iso

dynamodb = boto3.resource("dynamodb")
jobs_table = dynamodb.Table(os.environ["JOBS_TABLE"])
users_table = dynamodb.Table(os.environ["USERS_TABLE"])
sqs = boto3.client("sqs")
QUEUE_URL = os.environ["JOB_QUEUE_URL"]

# Plan Limits
PLAN_LIMITS = {
    "trial": 10,
    "starter": 100,
    "pro": 1000,
    "enterprise": float('inf')
}


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
    """Create a new scraping job after enforcing quotas."""
    # 1. Fetch user record for quota check
    user_resp = users_table.get_item(Key={"userId": user_id})
    user = user_resp.get("Item")
    
    if not user:
        return build_response(403, {"error": "User profile not found. Please log in again."})

    plan = user.get("plan", "trial")
    
    # 2. Check trial expiration
    if plan == "trial":
        expires_at_str = user.get("trialExpiresAt")
        if expires_at_str:
            from datetime import datetime
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", ""))
            if datetime.utcnow() > expires_at:
                return build_response(403, {"error": "Your free trial has expired. Please upgrade to continue."})

    # 3. Check monthly job limit
    jobs_used = int(user.get("jobsUsedThisMonth", 0))
    limit = PLAN_LIMITS.get(plan, 10)
    
    if jobs_used >= limit:
        return build_response(403, {"error": "Monthly job limit reached. Please upgrade your plan."})

    # 4. Success -> Proceed with job creation
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

    # Save job record
    jobs_table.put_item(Item=job_item)

    # 5. Increment jobsUsedThisMonth
    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET jobsUsedThisMonth = jobsUsedThisMonth + :inc, updatedAt = :now",
        ExpressionAttributeValues={
            ":inc": 1,
            ":now": now
        }
    )

    # Publish to SQS
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
