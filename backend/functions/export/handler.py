"""Export Lambda Handler – Generate presigned download URLs for scraped data."""
import os
import json
import csv
import io
from datetime import datetime
import boto3

from shared.utils import build_response, get_user_id

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

# Extract environment resources
JOBS_TABLE = os.environ.get("JOBS_TABLE")
# Core requirement: Fetch bucket name from explicitly named variable
DATA_BUCKET = os.environ.get("SCRAPED_DATA_BUCKET")


def flatten_dict(d, parent_key='', sep='_'):
    """
    Flatten nested dictionary up to 2 levels.
    e.g. {"price": {"value": 10}} becomes {"price_value": 10}
    """
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            # Nested dictionary level 2 extraction
            for sub_k, sub_v in v.items():
                items.append((f"{new_key}{sep}{sub_k}", sub_v))
        else:
            items.append((new_key, v))
    return dict(items)


def lambda_handler(event, context):
    """Generate a presigned URL for downloading scraped data in CSV or JSON."""
    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    # 1. Accept GET request query parameters
    query_params = event.get("queryStringParameters") or {}
    job_id = query_params.get("jobId")
    session_id = query_params.get("sessionId")
    req_format = query_params.get("format", "csv").lower()

    if not job_id or not session_id:
        return build_response(400, {"error": "Missing required parameters"})

    # 2. Key pattern to retrieve JSON output 
    raw_key = f"results/{session_id}/{job_id}/output.json"

    try:
        if req_format == "json":
            # 3. Direct pre-signed URL to raw JSON
            try:
                s3.head_object(Bucket=DATA_BUCKET, Key=raw_key)
            except s3.exceptions.ClientError as e:
                # Validate File Not Found explicitly
                if e.response['Error']['Code'] == '404':
                    return build_response(404, {"error": "Job results not found"})
                raise
                
            presigned_url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": DATA_BUCKET, "Key": raw_key},
                ExpiresIn=3600  # URL expires in 1 hour
            )

            # 5. Return success json shape
            return build_response(200, {
                "downloadUrl": presigned_url,
                "format": "json",
                "jobId": job_id,
                "generatedAt": datetime.utcnow().isoformat() + "Z"
            })

        elif req_format == "csv":
            # 4. CSV Conversion Process
            try:
                # Read entire JSON array directly from S3
                response = s3.get_object(Bucket=DATA_BUCKET, Key=raw_key)
                file_content = response["Body"].read().decode("utf-8")
                
                # Check serialization format (array or lines)
                try:
                    data = json.loads(file_content)
                except json.JSONDecodeError:
                    data = [json.loads(line) for line in file_content.strip().split('\n') if line]

                if not data:
                    return build_response(404, {"error": "Job results are empty"})
                
                if not isinstance(data, list):
                    data = [data]

                # Flatten nested fields dynamically
                flattened_data = [flatten_dict(item) for item in data]
                
                # Identify diverse header columns mapping everything found
                headers = set()
                for item in flattened_data:
                    headers.update(item.keys())
                headers = sorted(list(headers))

                # Output into CSV natively
                output = io.StringIO()
                writer = csv.DictWriter(output, fieldnames=headers)
                writer.writeheader()
                for row in flattened_data:
                    writer.writerow(row)
                
                csv_content = output.getvalue()
                output.close()

                # Upload generated CSV map
                csv_key = f"exports/{session_id}/{job_id}/output.csv"
                s3.put_object(
                    Bucket=DATA_BUCKET,
                    Key=csv_key,
                    Body=csv_content,
                    ContentType="text/csv"
                )

                # Return URL pointing securely to CSV path
                presigned_url = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": DATA_BUCKET, "Key": csv_key},
                    ExpiresIn=3600
                )

                return build_response(200, {
                    "downloadUrl": presigned_url,
                    "format": "csv",
                    "jobId": job_id,
                    "generatedAt": datetime.utcnow().isoformat() + "Z"
                })

            except s3.exceptions.NoSuchKey:
                return build_response(404, {"error": "Job results not found"})

        else:
            return build_response(400, {"error": "Invalid format requested. Valid options: 'csv' or 'json'"})

    except Exception as e:
        # 6. Global exception catching & CloudWatch visibility
        print(f"Export Handler Error: {str(e)}")
        return build_response(500, {"error": "Internal server error processing the export request"})
