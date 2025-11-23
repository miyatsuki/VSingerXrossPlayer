# VSingerXrossPlayer Collector

YouTube video metadata collector for VSingerXrossPlayer.

## Overview

The collector fetches video metadata from YouTube Data API v3 and stores it in DynamoDB. It supports both local development (with DynamoDB Local) and AWS Lambda deployment.

## Setup

### 1. Install Dependencies

```bash
cd collector
uv sync
```

### 2. Configure Environment

Create a `.env` file in the `collector/` directory:

```env
# Required
YOUTUBE_API_KEY=your_youtube_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Target channels (comma-separated)
TARGET_CHANNEL_IDS=UC1234...,UC5678...

# For local DynamoDB
DYNAMODB_ENDPOINT_URL=http://localhost:8000

# For AWS DynamoDB
AWS_REGION=ap-northeast-1
VIDEOS_TABLE_NAME=vsxp-videos
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
cd collector
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

### Video Enrichment

After collecting videos, enrich them with AI-generated metadata (song titles, singers, etc.):

```bash
cd collector

# Enrich videos from a specific channel
uv run python -m collector.enrich_batch --channel-id UC1234567890

# Enrich with a limit
uv run python -m collector.enrich_batch --channel-id UC1234567890 --max-videos 50

# Enrich all channels from .env
uv run python -m collector.enrich_batch
```

**What enrichment does:**

- Classifies video type (SONG/GAME/UNKNOWN) using Gemini API
- Extracts song information for cover videos:
  - Song title (official name via Google Search)
  - Singer names
  - Original artists
  - Original song URL (if available)
- Filters by duration (60s - 20min) to exclude Shorts and live streams
- Updates DynamoDB with enriched metadata

### AWS Lambda Deployment

The `handler.py` provides a Lambda handler function:

1. Package the collector directory
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
- \***\*main**.py\*\*: Python module entry point

## Data Model

DynamoDB table schema (`vsxp-videos`):

- **Partition Key**: `channel_id` (String)
- **Sort Key**: `video_id` (String)
- **Attributes**:
  - `video_title` (String)
  - `description` (String)
  - `duration` (Number) - in seconds
  - `published_at` (String) - ISO 8601 format

Additional attributes can be added by enrichment pipelines (AI inference, etc.)

## Workflow

### 1. Collect Videos

```bash
uv run python -m collector.run_once --channel-id UC...
```

Fetches video metadata from YouTube and stores in DynamoDB.

### 2. Enrich Videos

```bash
uv run python -m collector.enrich_batch --channel-id UC...
```

Analyzes videos with Gemini API to extract song information.

### 3. Access via Backend

The enriched data is automatically available through the FastAPI backend (`/videos` endpoint).

## Notes

- **Collection**: Skips live streams (duration == 0), handles pagination automatically
- **Enrichment**:
  - Uses Gemini API with Google Search grounding for accurate song information
  - Filters by duration (60s - 20min) to focus on cover songs
  - Rate limited to 1 request/second
  - Skips already enriched videos (those with song_title or game_title)
- Errors during processing are logged but don't stop the entire process
