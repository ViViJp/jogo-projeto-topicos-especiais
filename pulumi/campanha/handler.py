import json
import os

import boto3

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


def lambda_handler(event, context):
    body = event if isinstance(event, dict) else {}
    if "body" in body and isinstance(body["body"], str):
        body = json.loads(body["body"] or "{}")
    user_id = body.get("userId", "joao")
    if body.get("op") == "get":
        item = table.get_item(Key={"id": user_id}).get("Item")
        return {"statusCode": 200, "body": json.dumps(item or {}, default=str)}
    table.put_item(Item={"id": user_id, "fase": body.get("fase", "1")})
    return {"statusCode": 200, "body": json.dumps({"ok": True, "id": user_id})}
