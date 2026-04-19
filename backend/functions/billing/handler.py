"""Billing Lambda Handler – Razorpay integration for SaaS subscriptions."""
import json
import os
import boto3
import razorpay
from shared.utils import build_response, get_user_id, now_iso

dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ["USERS_TABLE"])

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_123")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "dummy_secret")

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

PLAN_PRICES = {
    "starter": 99900,  # 999 INR in paise
    "pro": 299900,     # 2999 INR
    "enterprise": 999900 # 9999 INR
}

def lambda_handler(event, context):
    http_method = event["httpMethod"]
    path = event.get("path", "")
    
    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    try:
        if http_method == "POST":
            if path.endswith("/create-order"):
                body = json.loads(event.get("body") or "{}")
                return create_order(user_id, body)
            elif path.endswith("/verify-payment"):
                body = json.loads(event.get("body") or "{}")
                return verify_payment(user_id, body)
        
        return build_response(405, {"error": "Method not allowed"})
    except Exception as e:
        print(f"Billing Error: {e}")
        return build_response(500, {"error": str(e)})

def create_order(user_id, body):
    plan = body.get("plan")
    if plan not in PLAN_PRICES:
        return build_response(400, {"error": "Invalid plan selected"})
    
    order_data = {
        "amount": PLAN_PRICES[plan],
        "currency": "INR",
        "receipt": f"receipt_{user_id}_{plan}",
        "notes": {
            "userId": user_id,
            "plan": plan
        }
    }
    
    order = client.order.create(data=order_data)
    return build_response(200, order)

def verify_payment(user_id, body):
    razorpay_payment_id = body.get("razorpay_payment_id")
    razorpay_order_id = body.get("razorpay_order_id")
    razorpay_signature = body.get("razorpay_signature")
    target_plan = body.get("plan")
    
    params_dict = {
        'razorpay_order_id': razorpay_order_id,
        'razorpay_payment_id': razorpay_payment_id,
        'razorpay_signature': razorpay_signature
    }
    
    try:
        # Verify signature
        client.utility.verify_payment_signature(params_dict)
        
        # Upgrade plan in DynamoDB
        users_table.update_item(
            Key={"userId": user_id},
            UpdateExpression="SET #p = :p, updatedAt = :now, razorpaySubscriptionId = :sId",
            ExpressionAttributeValues={
                ":p": target_plan,
                ":now": now_iso(),
                ":sId": razorpay_payment_id # Simple tracking for now
            },
            ExpressionAttributeNames={"#p": "plan"}
        )
        
        return build_response(200, {"message": f"Successfully upgraded to {target_plan} plan"})
    except Exception as e:
        print(f"Signature verify failed: {e}")
        return build_response(400, {"error": "Payment verification failed"})
