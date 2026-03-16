"""Sessions Lambda Handler – CRUD operations for scraping sessions."""
import json
import os
import uuid

import boto3
from boto3.dynamodb.conditions import Key

from shared.utils import build_response, get_user_id, now_iso

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["SESSIONS_TABLE"])


def lambda_handler(event, context):
    """Route requests to appropriate session operations."""
    http_method = event["httpMethod"]
    path_params = event.get("pathParameters") or {}
    session_id = path_params.get("sessionId")

    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    try:
        if http_method == "GET" and not session_id:
            return list_sessions(user_id)
        elif http_method == "GET" and session_id:
            return get_session(user_id, session_id)
        elif http_method == "POST":
            body = json.loads(event.get("body") or "{}")
            return create_session(user_id, body)
        elif http_method == "PUT" and session_id:
            body = json.loads(event.get("body") or "{}")
            return update_session(user_id, session_id, body)
        elif http_method == "DELETE" and session_id:
            return delete_session(user_id, session_id)
        else:
            return build_response(405, {"error": "Method not allowed"})
    except Exception as e:
        print(f"Error: {e}")
        return build_response(500, {"error": "Internal server error"})


def list_sessions(user_id: str):
    """List all sessions for a user."""
    response = table.query(KeyConditionExpression=Key("userId").eq(user_id))
    return build_response(200, response["Items"])


def get_session(user_id: str, session_id: str):
    """Get a specific session."""
    response = table.get_item(Key={"userId": user_id, "sessionId": session_id})
    item = response.get("Item")
    if not item:
        return build_response(404, {"error": "Session not found"})
    return build_response(200, item)


def create_session(user_id: str, body: dict):
    """Create a new scraping session."""
    session_id = str(uuid.uuid4())
    now = now_iso()

    item = {
        "userId": user_id,
        "sessionId": session_id,
        "name": body.get("name", "Untitled Session"),
        "targetUrl": body.get("targetUrl", ""),
        "selectors": body.get("selectors", {}),
        "pagination": body.get("pagination", {}),
        "proxy": body.get("proxy", {}),
        "schedule": body.get("schedule"),
        "status": "created",
        "createdAt": now,
        "updatedAt": now,
    }

    table.put_item(Item=item)
    return build_response(201, item)


def update_session(user_id: str, session_id: str, body: dict):
    """Update an existing session."""
    update_expr_parts = []
    expr_attr_values = {}
    expr_attr_names = {}

    allowed_fields = ["name", "targetUrl", "selectors", "pagination", "proxy", "schedule", "status"]

    for field in allowed_fields:
        if field in body:
            placeholder = f":{field}"
            name_placeholder = f"#{field}"
            update_expr_parts.append(f"{name_placeholder} = {placeholder}")
            expr_attr_values[placeholder] = body[field]
            expr_attr_names[name_placeholder] = field

    if not update_expr_parts:
        return build_response(400, {"error": "No valid fields to update"})

    # Always update updatedAt
    update_expr_parts.append("#updatedAt = :updatedAt")
    expr_attr_values[":updatedAt"] = now_iso()
    expr_attr_names["#updatedAt"] = "updatedAt"

    table.update_item(
        Key={"userId": user_id, "sessionId": session_id},
        UpdateExpression="SET " + ", ".join(update_expr_parts),
        ExpressionAttributeValues=expr_attr_values,
        ExpressionAttributeNames=expr_attr_names,
    )

    return build_response(200, {"message": "Session updated", "sessionId": session_id})


def delete_session(user_id: str, session_id: str):
    """Delete a session."""
    table.delete_item(Key={"userId": user_id, "sessionId": session_id})
    return build_response(200, {"message": "Session deleted", "sessionId": session_id})
