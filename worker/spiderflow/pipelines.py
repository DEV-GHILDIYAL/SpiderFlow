"""Scrapy Pipelines for SpiderFlow worker."""
import json
import os
import time

import boto3


class S3Pipeline:
    """Uploads scraped items to S3 in JSONL format, batched per page."""

    def __init__(self):
        self.s3 = boto3.client("s3")
        self.bucket = os.environ.get("DATA_BUCKET", "")
        self.items_buffer = []  # Buffer items for batch upload

    def process_item(self, item, spider):
        """Buffer items and flush periodically."""
        self.items_buffer.append(dict(item))

        # Flush every 100 items
        if len(self.items_buffer) >= 100:
            self._flush(spider)

        return item

    def close_spider(self, spider):
        """Flush remaining items when spider closes."""
        if self.items_buffer:
            self._flush(spider)

    def _flush(self, spider):
        """Upload buffered items to S3 as a JSONL file."""
        if not self.items_buffer or not self.bucket:
            return

        user_id = getattr(spider, "user_id", "unknown")
        session_id = getattr(spider, "session_id", "unknown")
        job_id = getattr(spider, "job_id", "unknown")
        timestamp = int(time.time())

        key = f"users/{user_id}/sessions/{session_id}/jobs/{job_id}/data_{timestamp}.jsonl"

        body = "\n".join(json.dumps(item, default=str) for item in self.items_buffer)

        self.s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=body.encode("utf-8"),
            ContentType="application/jsonl",
        )

        spider.logger.info(f"Uploaded {len(self.items_buffer)} items to s3://{self.bucket}/{key}")
        self.items_buffer.clear()


class JobStatusPipeline:
    """Updates job metrics in DynamoDB as items are scraped."""

    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.jobs_table = self.dynamodb.Table(os.environ.get("JOBS_TABLE", "SpiderFlowJobs"))
        self.items_count = 0

    def process_item(self, item, spider):
        """Increment item counter and update progress periodically."""
        self.items_count += 1
        
        # Live update every 25 items
        if self.items_count % 25 == 0:
            self._update_db(spider)
            
        return item

    def close_spider(self, spider):
        """Update final job metrics."""
        self._update_db(spider)

    def _update_db(self, spider):
        """Perform the DynamoDB update for live status."""
        session_id = getattr(spider, "session_id", "")
        job_id = getattr(spider, "job_id", "")

        if session_id and job_id:
            try:
                self.jobs_table.update_item(
                    Key={"sessionId": session_id, "jobId": job_id},
                    UpdateExpression="SET pagesScraped = :p, itemsExtracted = :i, updatedAt = :u",
                    ExpressionAttributeValues={
                        ":p": getattr(spider, "pages_scraped", 0),
                        ":i": self.items_count,
                        ":u": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    },
                )
            except Exception as e:
                spider.logger.error(f"Failed to update live progress in DynamoDB: {e}")
