"""Users Lambda Handler – Manage user profiles, trials, and quotas."""
import json
import os
from datetime import datetime, timedelta

import boto3
from shared.utils import build_response, get_user_id, now_iso

dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ["USERS_TABLE"])

# Plan Definitions
PLANS = {
    "trial": {
        "job_limit": 10,
        "page_limit": 500,
        "scheduler": False,
        "name": "Free Trial"
    },
    "starter": {
        "job_limit": 100,
        "page_limit": 5000,
        "scheduler": True,
        "name": "Starter"
    },
    "pro": {
        "job_limit": 1000,
        "page_limit": 50000,
        "scheduler": True,
        "name": "Pro"
    },
    "enterprise": {
        "job_limit": float('inf'),
        "page_limit": float('inf'),
        "scheduler": True,
        "name": "Enterprise"
    }
}

def lambda_handler(event, context):
    """Route user requests."""
    http_method = event["httpMethod"]
    path = event.get("path", "")
    
    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    try:
        if http_method == "GET" and path.endswith("/users/me"):
            return get_or_create_user(user_id)
        elif http_method == "POST" and path.endswith("/reset-usage"):
            return reset_usage(user_id)
        else:
            return build_response(405, {"error": f"Method {http_method} for {path} not allowed"})
    except Exception as e:
        print(f"Error: {e}")
        return build_response(500, {"error": "Internal server error"})

def get_or_create_user(user_id: str):
    """Fetch user record or create new trial if missing."""
    response = users_table.get_item(Key={"userId": user_id})
    user = response.get("Item")
    
    now = datetime.utcnow()
    
    if not user:
        # First login: Create 7-day trial record
        trial_start = now
        trial_end = trial_start + timedelta(days=7)
        
        user = {
            "userId": user_id,
            "plan": "trial",
            "trialStartedAt": trial_start.isoformat() + "Z",
            "trialExpiresAt": trial_end.isoformat() + "Z",
            "jobsUsedThisMonth": 0,
            "pagesScrapedThisMonth": 0,
            "createdAt": now_iso(),
            "updatedAt": now_iso()
        }
        users_table.put_item(Item=user)
        print(f"Created new trial user: {user_id}")

    # Calculate trial status
    plan_id = user.get("plan", "trial")
    plan_config = PLANS.get(plan_id, PLANS["trial"])
    
    expires_at_str = user.get("trialExpiresAt")
    is_trial_expired = False
    trial_days_remaining = 0
    
    if plan_id == "trial" and expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", ""))
        delta = expires_at - now
        trial_days_remaining = max(0, delta.days)
        is_trial_expired = now > expires_at

    return build_response(200, {
        "userId": user_id,
        "plan": plan_id,
        "planName": plan_config["name"],
        "trialStartedAt": user.get("trialStartedAt"),
        "trialExpiresAt": user.get("trialExpiresAt"),
        "trialDaysRemaining": trial_days_remaining,
        "isTrialExpired": is_trial_expired,
        "jobsUsedThisMonth": int(user.get("jobsUsedThisMonth", 0)),
        "pagesScrapedThisMonth": int(user.get("pagesScrapedThisMonth", 0)),
        "jobLimit": plan_config["job_limit"],
        "pageLimit": plan_config["page_limit"],
        "schedulerEnabled": plan_config["scheduler"]
    })

def reset_usage(user_id: str):
    """Admin tool to reset usage stats."""
    # In production, check for admin role from Cognito groups here
    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET jobsUsedThisMonth = :zero, pagesScrapedThisMonth = :zero, updatedAt = :now",
        ExpressionAttributeValues={
            ":zero": 0,
            ":now": now_iso()
        }
    )
    return build_response(200, {"message": "Usage stats reset successfully"})
