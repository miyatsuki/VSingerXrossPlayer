"""
Batch enrichment CLI for existing videos.

Usage:
  uv run python -m collector.enrich_batch --channel-id UC1234... --max-videos 100
"""

import argparse
import sys
import time
from typing import List

from .config import get_collector_settings
from .db import VideoRepository
from .enricher import VideoEnricher
from .gemini_client import GeminiClient


def enrich_channel(
    channel_id: str,
    gemini_client: GeminiClient,
    video_repo: VideoRepository,
    max_videos: int = 0,
    sleep_seconds: float = 1.0,
) -> None:
    """
    Enrich videos from a single channel.

    Args:
      channel_id: YouTube channel ID
      gemini_client: Gemini API client
      video_repo: DynamoDB repository
      max_videos: Maximum number of videos to process (0 = no limit)
      sleep_seconds: Sleep time between API calls (rate limit)
    """
    print(f"\n{'='*60}")
    print(f"Enriching videos from channel: {channel_id}")
    print(f"{'='*60}\n")

    enricher = VideoEnricher(gemini_client, video_repo)

    # Get all videos from channel (unenriched videos have no song_title)
    videos = video_repo.list_videos_by_channel(channel_id)

    if not videos:
        print(f"No videos found for channel {channel_id}")
        return

    print(f"Found {len(videos)} total videos")

    # Filter videos that haven't been enriched yet
    unenriched = [v for v in videos if not v.song_title and not v.game_title]
    print(f"Unenriched videos: {len(unenriched)}")

    if not unenriched:
        print("All videos already enriched!")
        return

    # Apply limit if specified
    if max_videos > 0:
        unenriched = unenriched[:max_videos]
        print(f"Processing first {len(unenriched)} videos")

    # Process each video
    success_count = 0
    error_count = 0

    for i, video in enumerate(unenriched, 1):
        print(f"\n[{i}/{len(unenriched)}] Processing {video.video_id}...")

        try:
            success = enricher.enrich_video(channel_id, video.video_id)
            if success:
                success_count += 1
            else:
                error_count += 1
        except Exception as e:
            print(f"  ✗ Error: {e}")
            error_count += 1

        # Rate limit: sleep between requests
        if i < len(unenriched):
            time.sleep(sleep_seconds)

    print(f"\n{'='*60}")
    print(f"Enrichment complete!")
    print(f"  Success: {success_count}")
    print(f"  Errors:  {error_count}")
    print(f"{'='*60}\n")


def main(channel_ids: List[str], max_videos: int = 0) -> None:
    """
    Main entry point for batch enrichment.

    Args:
      channel_ids: List of YouTube channel IDs to process
      max_videos: Maximum videos per channel (0 = no limit)
    """
    settings = get_collector_settings()

    gemini_client = GeminiClient(settings.gemini_api_key)
    video_repo = VideoRepository.from_settings(settings)

    for channel_id in channel_ids:
        try:
            enrich_channel(channel_id, gemini_client, video_repo, max_videos)
        except Exception as e:
            print(f"\nError processing channel {channel_id}: {e}", file=sys.stderr)
            continue


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch enrich videos with Gemini API")
    parser.add_argument(
        "--channel-id",
        type=str,
        action="append",
        dest="channel_ids",
        help="YouTube channel ID to enrich (can be specified multiple times)",
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
