import json
import os
import uuid
import time
import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
sqs = boto3.client("sqs")

SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
JOBS_TABLE = os.environ["JOBS_TABLE"]
JOB_QUEUE_URL = os.environ["JOB_QUEUE_URL"]

sessions_table = dynamodb.Table(SESSIONS_TABLE)
jobs_table = dynamodb.Table(JOBS_TABLE)

def lambda_handler(event, context):
    print("Starting SpiderFlow Daily Scheduler...")
    summary = {
        "total_sessions_found": 0,
        "total_jobs_dispatched": 0,
        "any_errors": []
    }
    
    try:
        # Scan for active sessions
        response = sessions_table.scan(
            FilterExpression=Attr("status").eq("active")
        )
        items = response.get("Items", [])
        print(f"Found {len(items)} active sessions to schedule.")
        summary["total_sessions_found"] = len(items)
        
        for session in items:
            session_id = session.get("sessionId")
            user_id = session.get("userId")
            job_id = str(uuid.uuid4())
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            
            try:
                # 1. Write pending job to DynamoDB
                jobs_table.put_item(
                    Item={
                        "sessionId": session_id,
                        "jobId": job_id,
                        "userId": user_id,
                        "status": "pending",
                        "createdAt": now_iso,
                        "updatedAt": now_iso
                    }
                )
                
                # 2. Send SQS Message
                message_body = {
                    "jobId": job_id,
                    "sessionId": session_id,
                    "userId": user_id
                }
                
                sqs.send_message(
                    QueueUrl=JOB_QUEUE_URL,
                    MessageBody=json.dumps(message_body)
                )
                
                summary["total_jobs_dispatched"] += 1
                print(f"Successfully dispatched job {job_id} for session {session_id}")
                
            except Exception as e:
                error_msg = f"Failed to dispatch job for session {session_id}: {str(e)}"
                print(error_msg)
                summary["any_errors"].append(error_msg)
                
    except Exception as base_e:
        print(f"Critical Scheduler Error: {str(base_e)}")
        summary["any_errors"].append(f"Scheduler failure: {str(base_e)}")
        
    finally:
        print(f"Scheduler completed with summary: {json.dumps(summary)}")
        return {
            "statusCode": 200,
            "body": json.dumps(summary)
        }
