# VSingerXrossPlayer Collector

YouTube video metadata collector for VSingerXrossPlayer.

## Overview

The collector fetches video metadata from YouTube Data API v3 and stores it in DynamoDB. It supports both local development (with DynamoDB Local) and AWS Lambda deployment.

## Setup

### 1. Install Dependencies

```bash
cd backend
uv sync
```

### 2. Configure Environment

Create a `.env` file in the `backend/` directory:

```env
# Required
YOUTUBE_API_KEY=your_youtube_api_key_here

# Optional: Target channels (comma-separated)
TARGET_CHANNEL_IDS=UC1234...,UC5678...

# For local DynamoDB
DYNAMODB_ENDPOINT_URL=http://localhost:8000

# For AWS DynamoDB
AWS_REGION=ap-northeast-1
VIDEOS_TABLE_NAME=videos
```

### 3. Create DynamoDB Table

For local development with DynamoDB Local:

```bash
# Start DynamoDB Local (if using Docker)
docker run -p 8000:8000 amazon/dynamodb-local

# Create table
DYNAMODB_ENDPOINT_URL=http://localhost:8000 uv run python scripts/create_tables.py
```

For AWS DynamoDB:

```bash
AWS_REGION=ap-northeast-1 uv run python scripts/create_tables.py
```

## Usage

### Local Execution

Collect videos from a specific channel:

```bash
cd backend
uv run python -m collector.run_once --channel-id UC1234567890
```

Collect with a limit:

```bash
uv run python -m collector.run_once --channel-id UC1234567890 --max-videos 100
```

Collect from multiple channels:

```bash
uv run python -m collector.run_once --channel-id UC111... --channel-id UC222...
```

Use channels from `.env`:

```bash
uv run python -m collector.run_once
```

### AWS Lambda Deployment

The `collector/handler.py` provides a Lambda handler function:

1. Package the backend directory
2. Deploy to AWS Lambda
3. Configure environment variables (YOUTUBE_API_KEY, etc.)
4. Set up EventBridge (CloudWatch Events) for scheduled execution

Example Lambda event:

```json
{
  "channelId": "UC1234567890",
  "maxVideos": 100
}
```

## Architecture

- **youtube_client.py**: YouTube Data API v3 client
- **db.py**: DynamoDB repository for video storage
- **config.py**: Configuration management with pydantic-settings
- **run_once.py**: CLI entry point for local execution
- **handler.py**: AWS Lambda handler
- ****main**.py**: Python module entry point

## Data Model

DynamoDB table schema:

- **Partition Key**: `channel_id` (String)
- **Sort Key**: `video_id` (String)
- **Attributes**:
  - `video_title` (String)
  - `description` (String)
  - `duration` (Number) - in seconds
  - `published_at` (String) - ISO 8601 format

Additional attributes can be added by enrichment pipelines (AI inference, etc.)

## Notes

- The collector skips live streams (duration == 0)
- YouTube API allows 50 videos per request; the collector handles pagination automatically
- Existing videos are detected and skipped to avoid duplicates
- Errors during collection are logged but don't stop the entire process
