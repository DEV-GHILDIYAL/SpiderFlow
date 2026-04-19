"""SQS Consumer – Polls for scraping jobs and executes Scrapy spiders."""
import json
import os
import sys
import time
import signal

import boto3
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

from spiderflow.spiders.generic_spider import GenericSpider

sqs = boto3.client("sqs")
dynamodb = boto3.resource("dynamodb")
QUEUE_URL = os.environ["JOB_QUEUE_URL"]
DLQ_URL = os.environ.get("DLQ_URL", "")
JOBS_TABLE = os.environ["JOBS_TABLE"]
USERS_TABLE = os.environ.get("USERS_TABLE", "SpiderFlowUsers")
jobs_table = dynamodb.Table(JOBS_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

running = True


def signal_handler(sig, frame):
    """Gracefully shut down on SIGTERM/SIGINT."""
    global running
    print(f"Received signal {sig}, shutting down gracefully...")
    running = False


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


def update_job_status(session_id: str, job_id: str, status: str, **extra):
    """Update job status in DynamoDB."""
    update_expr = "SET #s = :s, updatedAt = :u"
    expr_values = {":s": status, ":u": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    expr_names = {"#s": "status"}

    for key, value in extra.items():
        update_expr += f", {key} = :{key}"
        expr_values[f":{key}"] = value

    jobs_table.update_item(
        Key={"sessionId": session_id, "jobId": job_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
        ExpressionAttributeNames=expr_names,
    )
    print(f"[STATUS] Job {job_id} is now '{status}'.")


def send_to_dlq(message, reason):
    """Sends the original SQS message directly to the Dead Letter Queue."""
    if not DLQ_URL:
        print("[WARNING] DLQ_URL is not set. Cannot send failed message to DLQ.")
        return

    try:
        body = json.loads(message["Body"])
        # Add metadata fields as requested
        body["dlqReason"] = reason
        body["dlqTimestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        
        sqs.send_message(
            QueueUrl=DLQ_URL,
            MessageBody=json.dumps(body)
        )
        print("[DLQ] Successfully sent failed job message to Dead Letter Queue.")
    except Exception as e:
        print(f"[DLQ] Failed to send message to DLQ: {e}")


def finalize_job_usage(user_id: str, pages_count: int):
    """Increment the user's monthly page count."""
    try:
        users_table.update_item(
            Key={"userId": user_id},
            UpdateExpression="SET pagesScrapedThisMonth = pagesScrapedThisMonth + :p",
            ExpressionAttributeValues={":p": pages_count}
        )
        print(f"[USAGE] Incremented {user_id} monthly pages by {pages_count}")
    except Exception as e:
        print(f"[ERROR] Failed to update usage for {user_id}: {e}")


def process_message(message):
    """Process a single SQS message by running a Scrapy crawl."""
    job_id = None
    session_id = None
    user_id = None
    
    try:
        body = json.loads(message["Body"])
        job_id = body["jobId"]
        session_id = body["sessionId"]
        user_id = body["userId"]

        print(f"Processing job {job_id} for session {session_id}")

        # 1. Update status to running before Scrapy crawl
        update_job_status(session_id, job_id, "running")

        # Load session config
        sessions_table = dynamodb.Table(os.environ.get("SESSIONS_TABLE", "SpiderFlowSessions"))
        session_resp = sessions_table.get_item(Key={"userId": user_id, "sessionId": session_id})
        session_config = session_resp.get("Item", {})

        target_url = session_config.get("targetUrl", "")
        selectors = session_config.get("selectors", {})
        pagination = session_config.get("pagination", {})
        # New parameter: scraping_provider
        scraping_provider = session_config.get("scraping_provider", "internal")

        if not target_url:
            raise ValueError("No target URL configured in the session")

        # Run Scrapy spider
        settings = get_project_settings()
        settings.set("FEEDS", {})  # Output handled by pipeline
        settings.set("SPIDERFLOW_JOB_ID", job_id)
        settings.set("SPIDERFLOW_SESSION_ID", session_id)
        settings.set("SPIDERFLOW_USER_ID", user_id)

        process = CrawlerProcess(settings)
        spider_kwargs = {
            "start_url": target_url,
            "selectors": selectors,
            "pagination": pagination,
            "job_id": job_id,
            "session_id": session_id,
            "user_id": user_id,
            "scraping_provider": scraping_provider
        }
        
        process.crawl(GenericSpider, **spider_kwargs)
        process.start(stop_after_crawl=True)

        # 2a. Fetch final stats (pages scraped) from DynamoDB job record
        # (GenericSpider updates this field during the crawl via pipeline)
        job_resp = jobs_table.get_item(Key={"sessionId": session_id, "jobId": job_id})
        job_item = job_resp.get("Item", {})
        pages_count = job_item.get("pagesScraped", 0)

        # 2b. Update status to completed
        completed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        update_job_status(session_id, job_id, "completed", completedAt=completed_at)
        
        # 2c. Finalize user usage tracking
        finalize_job_usage(user_id, pages_count)
        
        print(f"Job {job_id} crawl finished successfully. Total pages: {pages_count}")

    except Exception as e:
        # 3. Update status to failed, save errorMessage, and send to DLQ
        error_msg = str(e)
        if session_id and job_id:
            print(f"Job {job_id} threw an exception: {error_msg}")
            update_job_status(session_id, job_id, "failed", errorMessage=error_msg)
            # Call DLQ handler
            send_to_dlq(message, error_msg)
        else:
            print(f"Failed to process unparseable message: {error_msg}")
            # Ensure it ends up in DLQ even if parse completely failed
            send_to_dlq(message, error_msg)
            
    finally:
        # Cleanup log for the try/except/finally block requirement
        if job_id:
            print(f"Finished processing execution cycle for job: {job_id}")


def main():
    """Main consumer loop – poll SQS and process messages."""
    print(f"Worker started. Polling queue: {QUEUE_URL}")

    while running:
        try:
            response = sqs.receive_message(
                QueueUrl=QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20,  # Long polling
                VisibilityTimeout=900,  # 15 minutes
            )

            messages = response.get("Messages", [])
            if not messages:
                continue

            for message in messages:
                process_message(message)

                # Delete message after execution attempt finishes
                sqs.delete_message(
                    QueueUrl=QUEUE_URL,
                    ReceiptHandle=message["ReceiptHandle"],
                )

        except Exception as e:
            print(f"Consumer SQS polling error: {e}")
            time.sleep(5)

    print("Worker shut down.")


if __name__ == "__main__":
    main()
