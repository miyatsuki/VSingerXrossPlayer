# VSingerXrossPlayer Collector

YouTube video metadata collector for VSingerXrossPlayer.

## Overview

The collector fetches video metadata from YouTube Data API v3 and stores it in DynamoDB.

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

# AWS DynamoDB
AWS_REGION=ap-northeast-1
VIDEOS_TABLE_NAME=vsxp-videos
```

### 3. Create DynamoDB Table

```bash
uv run python scripts/create_tables.py
```

## Usage

### Local Execution

Collect videos from a specific channel (enrichment runs automatically):

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

**What the collector does:**

1. Fetches channel information (name and icon URL)
2. Fetches video metadata from YouTube API (title, description, duration, thumbnail URL)
3. Stores videos in DynamoDB
4. Automatically enriches each video using Gemini API:
   - Classifies video type (SONG/GAME/UNKNOWN)
   - Extracts song information for cover videos:
     - Song title (official name via Google Search grounding)
     - Singer names
     - Original artists
     - Original song URL (if available)
   - Filters by duration (60s - 20min) to exclude Shorts and live streams
5. Rate limits enrichment to 1 request/second

### Batch Enrichment (Optional)

If you need to re-enrich existing videos, use the batch enrichment tool:

```bash
# Enrich videos from a specific channel
uv run python -m collector.enrich_batch --channel-id UC1234567890

# Enrich with a limit
uv run python -m collector.enrich_batch --channel-id UC1234567890 --max-videos 50

# Enrich all channels from .env
uv run python -m collector.enrich_batch
```

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
- **Video Attributes**:
  - `video_title` (String)
  - `description` (String)
  - `duration` (Number) - in seconds
  - `published_at` (String) - ISO 8601 format
  - `thumbnail_url` (String) - video thumbnail image URL
- **Enrichment Attributes** (added automatically):
  - `video_type` (String) - SONG/GAME/UNKNOWN
  - `song_title` (String) - for SONG type videos
  - `singers` (List) - list of singer names
  - `is_cover` (Boolean) - whether this is a cover song
  - `link` (String) - original song URL (if available)

**Channel Information** (stored with `video_id` = "CHANNEL_INFO"):

- `channel_name` (String) - channel display name
- `channel_icon_url` (String) - channel avatar/icon URL

## Workflow

### 1. Collect and Enrich Videos

```bash
uv run python -m collector.run_once --channel-id UC...
```

This single command:

1. Fetches channel information (name and icon)
2. Fetches video metadata from YouTube
3. Stores videos in DynamoDB with thumbnail URLs
4. Automatically enriches each video with Gemini API

### 2. Access via Backend

The enriched data is automatically available through the FastAPI backend (`/videos` endpoint).

## Notes

- **Collection & Enrichment**:
  - Automatically fetches channel information (name and icon URL)
  - Fetches video thumbnails during collection
  - Skips live streams (duration == 0)
  - Handles pagination automatically
  - Enrichment runs automatically for each new video
  - Uses Gemini API with Google Search grounding for accurate song information
  - Filters by duration (60s - 20min) to focus on cover songs
  - Rate limited to 1 request/second
- Errors during processing are logged but don't stop the entire process
- The `enrich_batch` tool is available for re-enriching existing videos if needed
