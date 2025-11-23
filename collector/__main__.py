"""
Main entry point for the collector module.

Usage:
  uv run python -m collector.run_once --channel-id UC1234...
"""

import argparse
import sys

from .run_once import main

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
        from .config import get_collector_settings

        settings = get_collector_settings()
        if not settings.target_channel_ids:
            print("Error: No channel IDs specified", file=sys.stderr)
            print("Use --channel-id or set TARGET_CHANNEL_IDS in .env", file=sys.stderr)
            sys.exit(1)
        args.channel_ids = settings.target_channel_ids

    main(args.channel_ids, args.max_videos)
