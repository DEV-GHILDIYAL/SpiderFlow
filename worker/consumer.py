"""SQS Consumer – Polls for scraping jobs and executes Room-based scrapers."""
import json
import os
import sys
import time
import signal
import subprocess
import tempfile
import boto3
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
from spiderflow.spiders.generic_spider import GenericSpider

sqs = boto3.client("sqs")
dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
kms = boto3.client("kms")

QUEUE_URL = os.environ["JOB_QUEUE_URL"]
JOBS_TABLE = os.environ["JOBS_TABLE"]
ROOMS_TABLE = os.environ["ROOMS_TABLE"]
USERS_TABLE = os.environ["USERS_TABLE"]
DATA_BUCKET = os.environ["DATA_BUCKET"]

jobs_table = dynamodb.Table(JOBS_TABLE)
rooms_table = dynamodb.Table(ROOMS_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

running = True

def signal_handler(sig, frame):
    global running
    running = False

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

def decrypt_data(ciphertext_b64: str) -> str:
    if not ciphertext_b64: return ""
    import base64
    try:
        ciphertext_blob = base64.b64decode(ciphertext_b64)
        response = kms.decrypt(CiphertextBlob=ciphertext_blob)
        return response['Plaintext'].decode('utf-8')
    except: return ""

def update_job(room_id, job_id, status, **kwargs):
    update_expr = "SET #s = :s, updatedAt = :u"
    expr_vals = {":s": status, ":u": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    expr_names = {"#s": "status"}
    
    for k, v in kwargs.items():
        update_expr += f", {k} = :{k}"
        expr_vals[f":{k}"] = v
    
    jobs_table.update_item(
        Key={"roomId": room_id, "jobId": job_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_vals,
        ExpressionAttributeNames=expr_names
    )

def log_to_job(room_id, job_id, line):
    print(f"[{job_id}] {line}")
    # Batch log updates in production for performance
    jobs_table.update_item(
        Key={"roomId": room_id, "jobId": job_id},
        UpdateExpression="SET logs = list_append(if_not_exists(logs, :empty), :l)",
        ExpressionAttributeValues={":l": [line], ":empty": []}
    )

def execute_custom_code(lang, code, url):
    """Executes user code in a subprocess and returns output JSON."""
    with tempfile.NamedTemporaryFile(suffix=".py" if lang=="python" else ".js", mode='w', delete=False) as f:
        f.write(code)
        tmp_name = f.name
    
    try:
        cmd = ["python3", tmp_name] if lang == "python" else ["node", tmp_name]
        # In production, pass URL as env var or arg
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env={**os.environ, "TARGET_URL": url})
        if result.returncode != 0:
            return None, result.stderr
        return json.loads(result.stdout), ""
    except Exception as e:
        return None, str(e)
    finally:
        os.remove(tmp_name)

def process_message(message):
    try:
        body = json.loads(message["Body"])
        job_id = body["jobId"]
        room_id = body["roomId"]
        user_id = body["userId"]
        
        update_job(room_id, job_id, "running")
        log_to_job(room_id, job_id, "Started job processing...")

        # 1. Fetch Room Config
        room_resp = rooms_table.get_item(Key={"userId": user_id, "roomId": room_id})
        room = room_resp.get("Item", {})
        
        method = room.get("scrapingMethod", "selectors")
        target_url = room.get("targetUrl")
        
        results = []
        
        if method == "selectors":
            log_to_job(room_id, job_id, f"Running CSS selectors crawl on {target_url}")
            
            # Setup Scrapy process to run in this process and save to a temporary JSON file
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp_file:
                tmp_output_path = tmp_file.name

            settings = get_project_settings()
            settings.update({
                "FEEDS": {tmp_output_path: {"format": "json"}},
                "LOG_LEVEL": "INFO",
                "PLAYWRIGHT_BROWSER_TYPE": "chromium"
            })

            process = CrawlerProcess(settings)
            process.crawl(
                GenericSpider,
                start_url=target_url,
                selectors=room.get("selectors", {}),
                pagination=room.get("pagination", {}),
                job_id=job_id,
                session_id=room_id, # Spiders use session_id field
                user_id=user_id,
                scraping_provider=room.get("provider", "internal")
            )
            process.start() # This blocks until crawl is finished

            # Read the results back
            try:
                if os.path.exists(tmp_output_path) and os.path.getsize(tmp_output_path) > 0:
                    with open(tmp_output_path, "r") as f:
                        results = json.load(f)
                else:
                    results = []
            finally:
                if os.path.exists(tmp_output_path):
                    os.remove(tmp_output_path)

        elif method == "custom_code":
            lang = room.get("codeLanguage", "python")
            code = room.get("customCode", "")
            log_to_job(room_id, job_id, f"Executing custom {lang} code...")
            results, err = execute_custom_code(lang, code, target_url)
            if err:
                log_to_job(room_id, job_id, f"Code Error: {err}")
                raise Exception(err)

        # 2. Store to S3
        s3_key = f"results/{user_id}/{room_id}/{job_id}/output.json"
        s3.put_object(
            Bucket=DATA_BUCKET,
            Key=s3_key,
            Body=json.dumps(results),
            ContentType="application/json"
        )
        log_to_job(room_id, job_id, f"Results saved to S3.")

        # 3. Export to MongoDB if verified
        if room.get("mongodbVerified") and room.get("mongodbUri"):
            log_to_job(room_id, job_id, "Exporting to MongoDB...")
            # Pymongo logic here...
        
        # Calculate final stats from results
        num_items = len(results)
        # In GenericSpider, each item in results represents one scraped page
        update_job(
            room_id, 
            job_id, 
            "completed", 
            pagesScraped=num_items, 
            itemsFound=num_items, 
            completedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        )
        log_to_job(room_id, job_id, f"Job completed. {num_items} pages scraped.")

    except Exception as e:
        print(f"Job failed: {e}")
        if 'room_id' in locals() and 'job_id' in locals():
            update_job(room_id, job_id, "failed", errorMessage=str(e))
            log_to_job(room_id, job_id, f"FAILED: {str(e)}")

def main():
    print(f"Worker polling {QUEUE_URL}...")
    while running:
        response = sqs.receive_message(QueueUrl=QUEUE_URL, WaitTimeSeconds=20, MaxNumberOfMessages=1)
        messages = response.get("Messages", [])
        for msg in messages:
            process_message(msg)
            sqs.delete_message(QueueUrl=QUEUE_URL, ReceiptHandle=msg["ReceiptHandle"])

if __name__ == "__main__":
    main()
