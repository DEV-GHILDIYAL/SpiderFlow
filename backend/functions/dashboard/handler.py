"""Dashboard Lambda Handler – Aggregated metrics for the user dashboard."""
import os

import boto3
from boto3.dynamodb.conditions import Key

from shared.utils import build_response, get_user_id

dynamodb = boto3.resource("dynamodb")
sessions_table = dynamodb.Table(os.environ["SESSIONS_TABLE"])
jobs_table = dynamodb.Table(os.environ["JOBS_TABLE"])
s3 = boto3.client("s3")
DATA_BUCKET = os.environ["DATA_BUCKET"]


def lambda_handler(event, context):
    """Return dashboard metrics for the authenticated user."""
    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    try:
        # Fetch all sessions for the user
        sessions_resp = sessions_table.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        )
        sessions = sessions_resp.get("Items", [])

        # Aggregate job metrics across all sessions
        total_jobs = 0
        completed_jobs = 0
        failed_jobs = 0
        queued_jobs = 0
        running_jobs = 0
        total_pages_scraped = 0
        total_items_extracted = 0

        for session in sessions:
            session_id = session["sessionId"]
            jobs_resp = jobs_table.query(
                KeyConditionExpression=Key("sessionId").eq(session_id)
            )
            jobs = jobs_resp.get("Items", [])
            total_jobs += len(jobs)

            for job in jobs:
                status = job.get("status", "unknown")
                if status == "completed":
                    completed_jobs += 1
                elif status == "failed":
                    failed_jobs += 1
                elif status == "queued":
                    queued_jobs += 1
                elif status == "running":
                    running_jobs += 1

                total_pages_scraped += int(job.get("pagesScraped", 0))
                total_items_extracted += int(job.get("itemsExtracted", 0))

        # Estimate storage usage
        storage_bytes = 0
        try:
            paginator = s3.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=DATA_BUCKET, Prefix=f"users/{user_id}/"):
                for obj in page.get("Contents", []):
                    storage_bytes += obj["Size"]
        except Exception:
            pass  # Gracefully handle S3 listing errors

        metrics = {
            "totalSessions": len(sessions),
            "totalJobs": total_jobs,
            "completedJobs": completed_jobs,
            "failedJobs": failed_jobs,
            "queuedJobs": queued_jobs,
            "runningJobs": running_jobs,
            "totalPagesScraped": total_pages_scraped,
            "totalItemsExtracted": total_items_extracted,
            "storageUsedMB": round(storage_bytes / (1024 * 1024), 2),
        }

        return build_response(200, metrics)

    except Exception as e:
        print(f"Dashboard error: {e}")
        return build_response(500, {"error": "Internal server error"})
