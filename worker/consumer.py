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
JOBS_TABLE = os.environ["JOBS_TABLE"]
jobs_table = dynamodb.Table(JOBS_TABLE)

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


def process_message(message):
    """Process a single SQS message by running a Scrapy crawl."""
    body = json.loads(message["Body"])
    job_id = body["jobId"]
    session_id = body["sessionId"]
    user_id = body["userId"]

    print(f"Processing job {job_id} for session {session_id}")

    # Update status to running
    update_job_status(session_id, job_id, "running")

    try:
        # Load session config from DynamoDB
        sessions_table = dynamodb.Table(os.environ.get("SESSIONS_TABLE", "SpiderFlowSessions"))
        session_resp = sessions_table.get_item(Key={"userId": user_id, "sessionId": session_id})
        session_config = session_resp.get("Item", {})

        target_url = session_config.get("targetUrl", "")
        selectors = session_config.get("selectors", {})
        pagination = session_config.get("pagination", {})

        if not target_url:
            update_job_status(session_id, job_id, "failed", errors=["No target URL configured"])
            return

        # Run Scrapy spider
        settings = get_project_settings()
        settings.set("FEEDS", {})  # Output handled by pipeline
        settings.set("SPIDERFLOW_JOB_ID", job_id)
        settings.set("SPIDERFLOW_SESSION_ID", session_id)
        settings.set("SPIDERFLOW_USER_ID", user_id)

        process = CrawlerProcess(settings)
        process.crawl(
            GenericSpider,
            start_url=target_url,
            selectors=selectors,
            pagination=pagination,
            job_id=job_id,
            session_id=session_id,
            user_id=user_id,
        )
        process.start(stop_after_crawl=True)

        update_job_status(session_id, job_id, "completed")
        print(f"Job {job_id} completed successfully")

    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        update_job_status(session_id, job_id, "failed", errors=[str(e)])


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

                # Delete message after successful processing
                sqs.delete_message(
                    QueueUrl=QUEUE_URL,
                    ReceiptHandle=message["ReceiptHandle"],
                )

        except Exception as e:
            print(f"Consumer error: {e}")
            time.sleep(5)

    print("Worker shut down.")


if __name__ == "__main__":
    main()
