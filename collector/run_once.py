"""
Local CLI for running the collector once.

Usage:
  uv run python -m collector.run_once --channel-id UC1234... --max-videos 200
"""

import argparse
import sys
import time
from typing import List

from config import get_collector_settings
from db import SingerVideoIndexRepository, VideoRepository
from enricher import VideoEnricher
from gemini_client import GeminiClient
from more_itertools import chunked
from youtube_client import YouTubeClient


def collect_channel(
    channel_id: str,
    youtube_client: YouTubeClient,
    video_repo: VideoRepository,
    enricher: VideoEnricher,
    max_videos: int = 0,
) -> None:
    """
    Collect videos from a single channel, store in DynamoDB, and enrich.

    Args:
      channel_id: YouTube channel ID
      youtube_client: YouTube API client
      video_repo: DynamoDB repository
      enricher: Video enricher
      max_videos: Maximum number of videos to fetch (0 = no limit)
    """
    print(f"Fetching channel info: {channel_id}")

    # Fetch and store channel information
    try:
        channel_info = youtube_client.fetch_channel_info(channel_id)
        video_repo.upsert_channel_info(
            channel_id, channel_info["channel_name"], channel_info["channel_icon_url"]
        )
        print(f"  ✓ Channel: {channel_info['channel_name']}")
    except Exception as e:
        print(f"  ✗ Failed to fetch channel info: {e}", file=sys.stderr)
        channel_info = {"channel_name": ""}

    print(f"\nFetching video IDs from channel: {channel_id}")

    # Fetch all video IDs from the channel
    all_video_ids = youtube_client.fetch_video_ids_from_channel(
        channel_id, max_videos=max_videos
    )
    print(f"Found {len(all_video_ids)} videos in channel")

    # Check which videos already exist in DynamoDB
    existing_video_ids = video_repo.list_existing_video_ids(channel_id)
    print(f"Already stored: {len(existing_video_ids)} videos")

    # Calculate new videos to fetch
    new_video_ids = list(all_video_ids - existing_video_ids)
    print(f"New videos to collect: {len(new_video_ids)}")

    if not new_video_ids:
        print("No new videos to collect")
        return

    # Fetch videos in chunks of 50 (YouTube API limit)
    enriched_count = 0
    for i, chunk in enumerate(chunked(new_video_ids, 50)):
        chunk_list = list(chunk)
        print(f"\nProcessing chunk {i+1}: {len(chunk_list)} videos")

        videos = youtube_client.fetch_videos(chunk_list)
        print(f"Fetched {len(videos)} video details")

        # Store and enrich each video
        for video in videos:
            try:
                video_repo.upsert_video(video)
                print(f"  ✓ Stored: {video.video_id} - {video.title[:50]}")

                # Enrich the video immediately after storing
                try:
                    success = enricher.enrich_video(
                        channel_id, video.video_id, channel_info.get("channel_name", "")
                    )
                    if success:
                        enriched_count += 1
                    # Rate limit: 1 request per second
                    time.sleep(1.0)
                except Exception as enrich_error:
                    print(
                        f"  ✗ Enrichment failed for {video.video_id}: {enrich_error}",
                        file=sys.stderr,
                    )

            except Exception as e:
                print(f"  ✗ Failed to store {video.video_id}: {e}", file=sys.stderr)

    print(f"\nCollection complete! Stored {len(new_video_ids)} new videos")
    print(f"Enriched: {enriched_count} videos")


def main(channel_ids: List[str], max_videos: int = 0) -> None:
    """
    Main entry point for the collector.

    Args:
      channel_ids: List of YouTube channel IDs to collect
      max_videos: Maximum videos per channel (0 = no limit)
    """
    settings = get_collector_settings()

    youtube_client = YouTubeClient(settings.youtube_api_key)
    video_repo = VideoRepository.from_settings(settings)
    index_repo = SingerVideoIndexRepository.from_settings(settings)
    gemini_client = GeminiClient(settings.gemini_api_key)
    enricher = VideoEnricher(gemini_client, video_repo, index_repo)

    for channel_id in channel_ids:
        try:
            collect_channel(
                channel_id, youtube_client, video_repo, enricher, max_videos
            )
        except Exception as e:
            print(f"Error collecting channel {channel_id}: {e}", file=sys.stderr)
            continue


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collect YouTube videos to DynamoDB")
    parser.add_argument(
        "--channel-id",
        type=str,
        action="append",
        dest="channel_ids",
        help="YouTube channel ID to collect (can be specified multiple times)",
    )
    parser.add_argument(
        "--max-videos",
        type=int,
        default=0,
        help="Maximum number of videos per channel (default: no limit)",
    )

    args = parser.parse_args()

    if not args.channel_ids:
        # Use target channels from config if none specified
        settings = get_collector_settings()
        if not settings.target_channel_ids:
            print("Error: No channel IDs specified", file=sys.stderr)
            print("Use --channel-id or set TARGET_CHANNEL_IDS in .env", file=sys.stderr)
            sys.exit(1)
        args.channel_ids = settings.target_channel_ids

    main(args.channel_ids, args.max_videos)
