"""Rooms Lambda Handler – CRUD operations and MongoDB verification."""
import json
import os
import uuid
import boto3
from boto3.dynamodb.conditions import Key
from shared.utils import build_response, get_user_id, now_iso

dynamodb = boto3.resource("dynamodb")
rooms_table = dynamodb.Table(os.environ["ROOMS_TABLE"])
kms = boto3.client("kms")
KMS_KEY_ID = os.environ["KMS_KEY_ID"]

def encrypt_data(data: str) -> str:
    if not data: return ""
    response = kms.encrypt(
        KeyId=KMS_KEY_ID,
        Plaintext=data.encode('utf-8')
    )
    import base64
    return base64.b64encode(response['CiphertextBlob']).decode('utf-8')

def decrypt_data(ciphertext_b64: str) -> str:
    if not ciphertext_b64: return ""
    import base64
    ciphertext_blob = base64.b64decode(ciphertext_b64)
    response = kms.decrypt(
        CiphertextBlob=ciphertext_blob
    )
    return response['Plaintext'].decode('utf-8')

def lambda_handler(event, context):
    http_method = event["httpMethod"]
    path_params = event.get("pathParameters") or {}
    room_id = path_params.get("roomId")
    path = event.get("path", "")

    try:
        user_id = get_user_id(event)
    except ValueError as e:
        return build_response(401, {"error": str(e)})

    try:
        if http_method == "GET" and not room_id:
            return list_rooms(user_id)
        elif http_method == "POST" and not room_id:
            body = json.loads(event.get("body") or "{}")
            return create_room(user_id, body)
        elif room_id:
            if http_method == "GET":
                return get_room(user_id, room_id)
            elif http_method == "PUT":
                body = json.loads(event.get("body") or "{}")
                return update_room(user_id, room_id, body)
            elif http_method == "DELETE":
                return delete_room(user_id, room_id)
            elif http_method == "POST" and path.endswith("/verify-mongo"):
                return verify_mongo(user_id, room_id)
        
        return build_response(405, {"error": "Method not allowed"})
    except Exception as e:
        print(f"Error: {e}")
        return build_response(500, {"error": str(e)})

def list_rooms(user_id: str):
    response = rooms_table.query(KeyConditionExpression=Key("userId").eq(user_id))
    rooms = response.get("Items", [])
    # Mask sensitive fields for list
    for r in rooms:
        if "providerApiKey" in r: r["providerApiKey"] = "****"
        if "mongodbUri" in r: r["mongodbUri"] = "****"
    return build_response(200, rooms)

def create_room(user_id: str, body: dict):
    name = body.get("name")
    if not name:
        return build_response(400, {"error": "Room name is required"})
    
    room_id = str(uuid.uuid4())
    now = now_iso()
    
    item = {
        "userId": user_id,
        "roomId": room_id,
        "name": name,
        "status": "active",
        "createdAt": now,
        "updatedAt": now,
        # Default config
        "scrapingMethod": "selectors",
        "provider": "internal",
        "scheduleEnabled": False
    }
    
    rooms_table.put_item(Item=item)
    return build_response(201, item)

def get_room(user_id: str, room_id: str):
    response = rooms_table.get_item(Key={"userId": user_id, "roomId": room_id})
    item = response.get("Item")
    if not item:
        return build_response(404, {"error": "Room not found"})
    
    # Decrypt if needed for setup view (or just mask)
    if "providerApiKey" in item: item["providerApiKey"] = "****"
    if "mongodbUri" in item: item["mongodbUri"] = "****"
    return build_response(200, item)

def update_room(user_id: str, room_id: str, body: dict):
    update_expr = "SET "
    values = {":now": now_iso()}
    names = {"#updatedAt": "updatedAt"}
    
    fields = [
        "name", "targetUrl", "scrapingMethod", "selectors", "customCode",
        "codeLanguage", "provider", "scheduleEnabled", "scheduleCron",
        "mongodbDatabase", "mongodbCollection", "status"
    ]
    
    updates = []
    for f in fields:
        if f in body:
            placeholder = f":{f}"
            name_placeholder = f"#{f}"
            updates.append(f"{name_placeholder} = {placeholder}")
            values[placeholder] = body[f]
            names[name_placeholder] = f

    # Handle encryption for sensitive fields
    if "providerApiKey" in body and body["providerApiKey"] != "****":
        updates.append("#pKey = :pKey")
        values[":pKey"] = encrypt_data(body["providerApiKey"])
        names["#pKey"] = "providerApiKey"

    if "mongodbUri" in body and body["mongodbUri"] != "****":
        updates.append("#mUri = :mUri")
        values[":mUri"] = encrypt_data(body["mongodbUri"])
        names["#mUri"] = "mongodbUri"
        # Reset verification on URI change
        updates.append("#mVer = :mVer")
        values[":mVer"] = False
        names["#mVer"] = "mongodbVerified"

    if not updates:
        return build_response(400, {"error": "No update fields provided"})

    update_expr += ", ".join(updates) + ", #updatedAt = :now"
    
    rooms_table.update_item(
        Key={"userId": user_id, "roomId": room_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=values,
        ExpressionAttributeNames=names
    )
    
    return build_response(200, {"message": "Room updated"})

def delete_room(user_id: str, room_id: str):
    rooms_table.delete_item(Key={"userId": user_id, "roomId": room_id})
    # Note: In production, also delete all jobs for this room
    return build_response(200, {"message": "Room deleted"})

def verify_mongo(user_id: str, room_id: str):
    # Fetch room config
    response = rooms_table.get_item(Key={"userId": user_id, "roomId": room_id})
    room = response.get("Item")
    if not room or "mongodbUri" not in room:
        return build_response(400, {"error": "MongoDB URI not configured"})
    
    uri = decrypt_data(room["mongodbUri"])
    
    try:
        # We'd ideally use pymongo here, but for this demo logic:
        # try to connect with a short timeout
        from pymongo import MongoClient
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.server_info() # Trigger connection
        
        rooms_table.update_item(
            Key={"userId": user_id, "roomId": room_id},
            UpdateExpression="SET mongodbVerified = :v",
            ExpressionAttributeValues={":v": True}
        )
        return build_response(200, {"message": "MongoDB connection verified"})
    except ImportError:
        # Fallback if pymongo not in layer
        return build_response(200, {"message": "Mock verification successful (pymongo not detected)"})
    except Exception as e:
        return build_response(400, {"error": f"Connection failed: {str(e)}"})
