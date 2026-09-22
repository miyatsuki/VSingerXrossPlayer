"""
AWS Lambda handler for the collector.

This handler can be invoked by EventBridge on a schedule or manually.

Event format:
  {
    "channelUrl": "https://www.youtube.com/@handle",  // Optional: channel/video URL/handle/ID
    "channelId": "UC1234...",                          // Optional: deprecated, use channelUrl
    "maxVideos": 100,                                  // Optional: limit number of videos fetched
    "maxSongVideos": 50,                               // Optional: limit SONG videos processed
    "songSearchResults": 50,                           // Optional: channel-search candidates
    "overwrite": true                                  // Optional: re-process existing videos (default: false)
  }

Supported formats for channelUrl:
  - https://www.youtube.com/watch?v=VIDEO_ID (video URL - collects entire channel)
  - https://youtu.be/VIDEO_ID (short video URL - collects entire channel)
  - https://www.youtube.com/channel/UCxxxx (direct channel ID)
  - https://www.youtube.com/user/username (username)
  - https://www.youtube.com/@handle (YouTube handle)
  - Direct channel ID: UCxxxx
  - Direct handle: @handle
"""

import json
from typing import Any, Dict

from .channel_registry import load_channel_registry
from .config import get_collector_settings
from .db import SingerVideoIndexRepository, VideoRepository
from .enricher import VideoEnricher
from .gemini_client import GeminiClient
from .run_once import collect_channel
from .youtube_client import YouTubeClient


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function handler for collecting YouTube videos.

    Args:
      event: Lambda event (can specify channelUrl/channelId and maxVideos)
      context: Lambda context

    Returns:
      Response with status code and message
    """
    print("Event:", json.dumps(event))

    settings = get_collector_settings()
    youtube_client = YouTubeClient(settings.youtube_api_key)
    video_repo = VideoRepository.from_settings(settings)
    index_repo = SingerVideoIndexRepository.from_settings(settings)
    gemini_client = GeminiClient(
        settings.gemini_api_key,
        model=settings.gemini_model,
        catalog_path=settings.original_songs_path,
    )
    enricher = VideoEnricher(gemini_client, video_repo, index_repo, youtube_client)

    # Determine which channels to collect
    channel_urls = []
    if "channelUrl" in event and event["channelUrl"]:
        # Prefer new channelUrl parameter
        channel_urls = [event["channelUrl"]]
    elif "channelId" in event and event["channelId"]:
        # Fallback to deprecated channelId for backward compatibility
        channel_urls = [event["channelId"]]
    else:
        channel_urls = list(load_channel_registry(settings.channels_path))

    if not channel_urls:
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"error": "No channel URLs specified in event or configuration"}
            ),
        }

    max_videos = event.get("maxVideos", 0)
    max_song_videos = event.get("maxSongVideos", 0)
    song_search_results = event.get("songSearchResults", 0)
    overwrite = event.get("overwrite", False)

    results = []
    for channel_url in channel_urls:
        try:
            # Resolve URL/handle to canonical channel ID
            print(f"Resolving channel: {channel_url}")
            channel_id = youtube_client.resolve_channel_id(channel_url)
            print(f"  → Channel ID: {channel_id}")

            collect_channel(
                channel_id,
                youtube_client,
                video_repo,
                enricher,
                max_videos=max_videos,
                max_song_videos=max_song_videos,
                overwrite=overwrite,
                song_search_results=song_search_results,
            )
            results.append(
                {
                    "channel_url": channel_url,
                    "channel_id": channel_id,
                    "status": "success",
                }
            )
        except ValueError as e:
            # Invalid format or custom URL
            print(f"Error resolving channel {channel_url}: {e}")
            results.append(
                {"channel_url": channel_url, "status": "error", "error": str(e)}
            )
        except Exception as e:
            print(f"Error collecting channel {channel_url}: {e}")
            results.append(
                {"channel_url": channel_url, "status": "error", "error": str(e)}
            )

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Collection complete", "results": results}),
    }
