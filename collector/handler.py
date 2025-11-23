"""
AWS Lambda handler for the collector.

This handler can be invoked by EventBridge on a schedule or manually.

Event format:
  {
    "channelId": "UC1234...",  // Optional: specific channel to collect
    "maxVideos": 100           // Optional: limit number of videos
  }
"""

import json
from typing import Any, Dict

from config import get_collector_settings
from db import SingerVideoIndexRepository, VideoRepository
from enricher import VideoEnricher
from gemini_client import GeminiClient
from run_once import collect_channel
from youtube_client import YouTubeClient


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function handler for collecting YouTube videos.

    Args:
      event: Lambda event (can specify channelId and maxVideos)
      context: Lambda context

    Returns:
      Response with status code and message
    """
    print("Event:", json.dumps(event))

    settings = get_collector_settings()
    youtube_client = YouTubeClient(settings.youtube_api_key)
    video_repo = VideoRepository.from_settings(settings)
    index_repo = SingerVideoIndexRepository.from_settings(settings)
    gemini_client = GeminiClient(settings.gemini_api_key)
    enricher = VideoEnricher(gemini_client, video_repo, index_repo, youtube_client)

    # Determine which channels to collect
    channel_ids = []
    if "channelId" in event and event["channelId"]:
        channel_ids = [event["channelId"]]
    else:
        channel_ids = settings.target_channel_ids

    if not channel_ids:
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"error": "No channel IDs specified in event or configuration"}
            ),
        }

    max_videos = event.get("maxVideos", 0)

    results = []
    for channel_id in channel_ids:
        try:
            collect_channel(
                channel_id, youtube_client, video_repo, enricher, max_videos
            )
            results.append({"channel_id": channel_id, "status": "success"})
        except Exception as e:
            print(f"Error collecting channel {channel_id}: {e}")
            results.append(
                {"channel_id": channel_id, "status": "error", "error": str(e)}
            )

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Collection complete", "results": results}),
    }
