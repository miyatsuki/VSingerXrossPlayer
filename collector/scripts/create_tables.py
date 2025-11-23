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
from config import get_collector_settings


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


def create_singer_videos_table(client, table_name: str) -> None:
    """
    Create the singer-videos index table for optimized search.

    Table structure:
    - PK: singer_key (normalized singer name)
    - SK: sort_key (format: "{published_at}#{video_id}")
    - GSI_SONG_KEY: PK=song_key, SK=sort_key
    - GSI_VIDEO_ID: PK=video_id, SK=singer_key

    Args:
      client: DynamoDB client
      table_name: Name of the table to create
    """
    try:
        client.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "singer_key", "KeyType": "HASH"},
                {"AttributeName": "sort_key", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "singer_key", "AttributeType": "S"},
                {"AttributeName": "sort_key", "AttributeType": "S"},
                {"AttributeName": "song_key", "AttributeType": "S"},
                {"AttributeName": "video_id", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "GSI_SONG_KEY",
                    "KeySchema": [
                        {"AttributeName": "song_key", "KeyType": "HASH"},
                        {"AttributeName": "sort_key", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
                {
                    "IndexName": "GSI_VIDEO_ID",
                    "KeySchema": [
                        {"AttributeName": "video_id", "KeyType": "HASH"},
                        {"AttributeName": "singer_key", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
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
    create_singer_videos_table(client, settings.dynamodb_table_singer_videos)

    print("\n✓ All tables created successfully!")
    print(f"\nTables:")
    print(f"  1. {settings.dynamodb_table_videos}")
    print(f"     Schema: channel_id (PK), video_id (SK)")
    print(f"  2. {settings.dynamodb_table_singer_videos}")
    print(f"     Schema: singer_key (PK), sort_key (SK)")
    print(f"     GSI: GSI_SONG_KEY, GSI_VIDEO_ID")


if __name__ == "__main__":
    main()
