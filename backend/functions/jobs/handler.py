"""Jobs Lambda Handler – Trigger and monitor scraping jobs in a Room context."""
import json
import os
import uuid
import boto3
from boto3.dynamodb.conditions import Key
from shared.utils import build_response, get_user_id, now_iso

dynamodb = boto3.resource("dynamodb")
rooms_table = dynamodb.Table(os.environ["ROOMS_TABLE"])
jobs_table = dynamodb.Table(os.environ["JOBS_TABLE"])
users_table = dynamodb.Table(os.environ["USERS_TABLE"])
sqs = boto3.client("sqs")
s3 = boto3.client("s3")
QUEUE_URL = os.environ["JOB_QUEUE_URL"]
DATA_BUCKET = os.environ["DATA_BUCKET"]

PLAN_LIMITS = {
    "trial": {"rooms": 1, "jobs": 10, "pages": 500, "external": False, "code": False},
    "starter": {"rooms": 5, "jobs": 100, "pages": 5000, "external": True, "code": False},
    "pro": {"rooms": 20, "jobs": 1000, "pages": 50000, "external": True, "code": True},
    "enterprise": {"rooms": float('inf'), "jobs": float('inf'), "pages": float('inf'), "external": True, "code": True}
}

def lambda_handler(event, context):
    http_method = event["httpMethod"]
    path_params = event.get("pathParameters") or {}
    room_id = path_params.get("roomId")
    job_id = path_params.get("jobId")
    path = event.get("path", "")

    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    try:
        if http_method == "POST" and room_id and not job_id:
            return trigger_job(user_id, room_id)
        elif http_method == "GET" and room_id and not job_id:
            return list_jobs(room_id)
        elif http_method == "GET" and room_id and job_id:
            if path.endswith("/export"):
                return get_export(user_id, room_id, job_id)
            return get_job(room_id, job_id)
        
        return build_response(405, {"error": "Method not allowed"})
    except Exception as e:
        print(f"Error: {e}")
        return build_response(500, {"error": str(e)})

def list_jobs(room_id: str):
    response = jobs_table.query(KeyConditionExpression=Key("roomId").eq(room_id))
    return build_response(200, response.get("Items", []))

def trigger_job(user_id: str, room_id: str):
    # 1. Fetch user for quota check
    user_resp = users_table.get_item(Key={"userId": user_id})
    user = user_resp.get("Item")
    if not user:
        return build_response(403, {"error": "User profile not found"})

    plan_id = user.get("plan", "trial")
    limits = PLAN_LIMITS.get(plan_id, PLAN_LIMITS["trial"])

    # 2. Check Trial expiry
    if plan_id == "trial":
        from datetime import datetime
        expires_at = datetime.fromisoformat(user["trialExpiresAt"].replace("Z", ""))
        if datetime.utcnow() > expires_at:
            return build_response(403, {"error": "Free trial expired"})

    # 3. Check monthly job limit
    jobs_used = int(user.get("jobsUsedThisMonth", 0))
    if jobs_used >= limits["jobs"]:
        return build_response(403, {"error": "Monthly job limit reached"})

    # 4. Fetch room config for provider check
    room_resp = rooms_table.get_item(Key={"userId": user_id, "roomId": room_id})
    room = room_resp.get("Item")
    if not room: return build_response(404, {"error": "Room not found"})

    if room.get("provider") != "internal" and not limits["external"]:
        return build_response(403, {"error": "External providers require Starter plan+"})
    
    if room.get("scrapingMethod") == "custom_code" and not limits["code"]:
        return build_response(403, {"error": "Custom code requires Pro plan+"})

    # 5. Success -> Trigger
    job_id = str(uuid.uuid4())
    now = now_iso()
    
    job_item = {
        "roomId": room_id,
        "jobId": job_id,
        "userId": user_id,
        "status": "pending",
        "provider": room.get("provider", "internal"),
        "pagesScraped": 0,
        "itemsFound": 0,
        "logs": ["Job queued."],
        "createdAt": now,
        "updatedAt": now
    }
    
    jobs_table.put_item(Item=job_item)
    
    # Increment user usage
    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET jobsUsedThisMonth = jobsUsedThisMonth + :inc",
        ExpressionAttributeValues={":inc": 1}
    )

    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps({
            "jobId": job_id,
            "roomId": room_id,
            "userId": user_id
        })
    )
    
    return build_response(201, job_item)

def get_job(room_id: str, job_id: str):
    response = jobs_table.get_item(Key={"roomId": room_id, "jobId": job_id})
    item = response.get("Item")
    if not item:
        return build_response(404, {"error": "Job not found"})
    return build_response(200, item)

def get_export(user_id: str, room_id: str, job_id: str):
    # Expect results at results/{userId}/{roomId}/{jobId}/output.json
    key = f"results/{user_id}/{room_id}/{job_id}/output.json"
    
    url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': DATA_BUCKET, 'Key': key},
        ExpiresIn=3600
    )
    
    return build_response(200, {"downloadUrl": url})
