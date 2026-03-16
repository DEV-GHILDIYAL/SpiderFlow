"""Export Lambda Handler – Generate presigned download URLs for scraped data."""
import os

import boto3
from boto3.dynamodb.conditions import Key

from shared.utils import build_response, get_user_id

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
jobs_table = dynamodb.Table(os.environ["JOBS_TABLE"])
DATA_BUCKET = os.environ["DATA_BUCKET"]


def lambda_handler(event, context):
    """Generate a presigned URL for downloading scraped data."""
    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    query_params = event.get("queryStringParameters") or {}
    job_id = query_params.get("jobId")
    session_id = query_params.get("sessionId")

    if not job_id or not session_id:
        return build_response(400, {"error": "jobId and sessionId query parameters are required"})

    try:
        # Verify job exists and belongs to user
        job_resp = jobs_table.get_item(
            Key={"sessionId": session_id, "jobId": job_id}
        )
        job = job_resp.get("Item")
        if not job:
            return build_response(404, {"error": "Job not found"})
        if job.get("userId") != user_id:
            return build_response(403, {"error": "Access denied"})

        # List files for this job
        prefix = f"users/{user_id}/sessions/{session_id}/jobs/{job_id}/"
        response = s3.list_objects_v2(Bucket=DATA_BUCKET, Prefix=prefix)
        files = response.get("Contents", [])

        if not files:
            return build_response(404, {"error": "No data files found for this job"})

        # Generate presigned URLs for each file
        download_links = []
        for file_obj in files:
            key = file_obj["Key"]
            url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": DATA_BUCKET, "Key": key},
                ExpiresIn=3600,  # 1 hour
            )
            download_links.append({
                "filename": key.split("/")[-1],
                "size": file_obj["Size"],
                "url": url,
            })

        return build_response(200, {
            "jobId": job_id,
            "files": download_links,
        })

    except Exception as e:
        print(f"Export error: {e}")
        return build_response(500, {"error": "Internal server error"})
