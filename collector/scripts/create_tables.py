"""
Script to create DynamoDB tables for VSingerXrossPlayer.

Usage:
  # For local DynamoDB
  DYNAMODB_ENDPOINT_URL=http://localhost:8000 uv run python scripts/create_tables.py

  # For AWS DynamoDB
  AWS_REGION=ap-northeast-1 uv run python scripts/create_tables.py
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import boto3

from collector.config import get_collector_settings


def create_videos_table(client, table_name: str) -> None:
    """
    Create the videos table with channel_id (partition) and video_id (sort key).

    Args:
      client: DynamoDB client
      table_name: Name of the table to create
    """
    try:
        client.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "channel_id", "KeyType": "HASH"},
                {"AttributeName": "video_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "channel_id", "AttributeType": "S"},
                {"AttributeName": "video_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"✓ Created table: {table_name}")
    except client.exceptions.ResourceInUseException:
        print(f"✓ Table already exists: {table_name}")
    except Exception as e:
        print(f"✗ Error creating table {table_name}: {e}")
        raise


def main() -> None:
    """Create all required DynamoDB tables."""
    settings = get_collector_settings()

    client_kwargs = {"region_name": settings.aws_region}
    if settings.dynamodb_endpoint_url:
        client_kwargs["endpoint_url"] = settings.dynamodb_endpoint_url
        print(f"Using DynamoDB endpoint: {settings.dynamodb_endpoint_url}")
    else:
        print(f"Using AWS DynamoDB in region: {settings.aws_region}")

    client = boto3.client("dynamodb", **client_kwargs)

    print("\nCreating tables...")
    create_videos_table(client, settings.dynamodb_table_videos)

    print("\n✓ All tables created successfully!")
    print(f"\nTable name: {settings.dynamodb_table_videos}")
    print(f"Schema: channel_id (partition key), video_id (sort key)")


if __name__ == "__main__":
    main()
