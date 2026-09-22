"""
Local CLI for running the collector once.

Usage:
  uv run python -m collector.run_once --channel-url "https://www.youtube.com/@handle" --max-videos 200

Supported URL formats:
  - https://www.youtube.com/watch?v=VIDEO_ID (video URL - collects entire channel)
  - https://youtu.be/VIDEO_ID (short video URL - collects entire channel)
  - https://www.youtube.com/channel/UCxxxx (direct channel ID)
  - https://www.youtube.com/user/username (username)
  - https://www.youtube.com/@handle (YouTube handle)
  - Direct channel ID: UCxxxx
  - Direct handle: @handle
"""

import argparse
import sys
import time
from typing import List

from .channel_registry import load_channel_registry
from .config import get_collector_settings
from .db import SingerVideoIndexRepository, VideoRepository
from .enricher import VideoEnricher
from .gemini_client import GeminiClient
from more_itertools import chunked
from .url_parser import IdentifierType, parse_youtube_url
from .youtube_client import YouTubeClient


def collect_videos(
    video_urls: List[str],
    youtube_client: YouTubeClient,
    video_repo: VideoRepository,
    enricher: VideoEnricher,
    overwrite: bool = False,
) -> None:
    """Collect and enrich only the explicitly supplied YouTube videos."""
    video_ids = []
    for value in video_urls:
        identifier_type, video_id = parse_youtube_url(value)
        if identifier_type != IdentifierType.VIDEO_ID:
            raise ValueError(f"Not a YouTube video URL: {value}")
        if video_id not in video_ids:
            video_ids.append(video_id)

    videos = youtube_client.fetch_videos(video_ids)
    found_ids = {video.video_id for video in videos}
    missing_ids = [video_id for video_id in video_ids if video_id not in found_ids]
    if missing_ids:
        raise ValueError(f"Videos not found: {', '.join(missing_ids)}")

    channel_info = {}
    failures = 0
    completed = 0
    for video in videos:
        try:
            if not overwrite and video_repo.get_video(video.channel_id, video.video_id):
                print(f"Skipping stored video: {video.video_id}")
                continue
            if video.channel_id not in channel_info:
                info = youtube_client.fetch_channel_info(video.channel_id)
                channel_info[video.channel_id] = info
                video_repo.upsert_channel_info(
                    video.channel_id,
                    info["channel_name"],
                    info["channel_icon_url"],
                    info["subscriber_count"],
                )
            video_repo.upsert_video(video)
            print(f"Stored: {video.video_id} - {video.title[:50]}")
            result = enricher.enrich_video(
                video.channel_id,
                video.video_id,
                channel_info[video.channel_id]["channel_name"],
            )
            if result:
                completed += 1
            else:
                failures += 1
            time.sleep(1.0)
        except Exception as error:
            failures += 1
            print(f"Failed: {video.video_id} ({type(error).__name__})", file=sys.stderr)

    print(f"\nExplicit video collection complete: {completed} completed, {failures} unresolved/failed")
    if failures:
        raise RuntimeError(f"{failures} videos failed or remain unresolved")


def collect_channel(
    channel_id: str,
    youtube_client: YouTubeClient,
    video_repo: VideoRepository,
    enricher: VideoEnricher,
    max_videos: int = 0,
    max_song_videos: int = 0,
    overwrite: bool = False,
    song_search_results: int = 0,
) -> None:
    """
    Collect videos from a single channel, store them, and enrich them.

    Args:
      channel_id: YouTube channel ID
      youtube_client: YouTube API client
      video_repo: DynamoDB repository
      enricher: Video enricher
      max_videos: Maximum number of new videos to fetch (0 = no limit)
      max_song_videos: Maximum number of SONG videos to process (0 = no limit)
      overwrite: Re-process existing videos (default: False)
      song_search_results: Additional channel-search candidates (0 = disabled)
    """
    print(f"Fetching channel info: {channel_id}")

    # Fetch and store channel information
    try:
        channel_info = youtube_client.fetch_channel_info(channel_id)
        video_repo.upsert_channel_info(
            channel_id,
            channel_info["channel_name"],
            channel_info["channel_icon_url"],
            channel_info["subscriber_count"],
        )
        print(f"  ✓ Channel: {channel_info['channel_name']}")
    except Exception as e:
        print(f"  ✗ Failed to fetch channel info: {e}", file=sys.stderr)
        channel_info = {"channel_name": "", "subscriber_count": 0}

    if overwrite:
        existing_video_ids = set()
    else:
        existing_video_ids = video_repo.list_existing_video_ids(channel_id)
        print(f"Already stored: {len(existing_video_ids)} videos")

    print(f"\nFetching video IDs from channel: {channel_id}")

    # Fetch new video IDs from the channel. Stored IDs do not consume the
    # max_videos allowance, so pagination continues until enough new videos
    # are found or the uploads playlist is exhausted.
    all_video_ids = youtube_client.fetch_video_ids_from_channel(
        channel_id,
        max_videos=max_videos,
        exclude_video_ids=existing_video_ids,
    )
    print(f"Found {len(all_video_ids)} videos to consider in channel uploads")
    if song_search_results > 0:
        search_ids = youtube_client.search_song_candidate_ids(
            channel_id, max_results=song_search_results,
        )
        new_search_ids = search_ids - all_video_ids
        all_video_ids.update(search_ids)
        print(
            f"Found {len(search_ids)} song-search candidates "
            f"({len(new_search_ids)} outside the upload window)"
        )

    # Determine which videos to process
    if overwrite:
        # Overwrite mode: process all videos
        videos_to_process = list(all_video_ids)
        print(
            f"Overwrite mode: Processing all {len(videos_to_process)} videos (including existing)"
        )
    else:
        # Normal mode: only new videos
        videos_to_process = list(all_video_ids - existing_video_ids)
        print(f"New videos to collect: {len(videos_to_process)}")

    if not videos_to_process:
        print("No videos to process")
        return

    # Fetch videos in chunks of 50 (YouTube API limit)
    enriched_count = 0
    song_count = 0
    game_count = 0
    unknown_count = 0
    should_stop = False
    error_count = 0

    for i, chunk in enumerate(chunked(videos_to_process, 50)):
        if should_stop:
            break

        chunk_list = list(chunk)
        print(f"\nProcessing chunk {i+1}: {len(chunk_list)} videos")

        videos = youtube_client.fetch_videos(chunk_list)
        print(f"Fetched {len(videos)} video details")

        # Store and enrich each video
        for video in videos:
            if video.duration == 0:
                continue
            try:
                video_repo.upsert_video(video)
                print(f"  ✓ Stored: {video.video_id} - {video.title[:50]}")

                # Enrich the video immediately after storing
                try:
                    video_type = enricher.enrich_video(
                        channel_id, video.video_id, channel_info.get("channel_name", "")
                    )

                    if video_type:
                        enriched_count += 1
                        # Count by type
                        if video_type == "SONG":
                            song_count += 1
                            if max_song_videos > 0:
                                print(f"    [SONG {song_count}/{max_song_videos}]")
                            else:
                                print(f"    [SONG {song_count}]")

                            # Check if we reached the SONG limit
                            if max_song_videos > 0 and song_count >= max_song_videos:
                                print(
                                    f"\n  → Reached limit of {max_song_videos} SONG videos"
                                )
                                print(f"  → Skipping remaining videos")
                                should_stop = True
                                break
                        elif video_type == "GAME":
                            game_count += 1
                            print(f"    [GAME]")
                        elif video_type == "UNKNOWN":
                            unknown_count += 1
                            print(f"    [UNKNOWN]")

                    else:
                        error_count += 1

                    # Delay between videos (each video may make multiple API calls)
                    time.sleep(1.0)
                except Exception as enrich_error:
                    error_count += 1
                    print(
                        f"  ✗ Enrichment failed for {video.video_id}: {enrich_error}",
                        file=sys.stderr,
                    )

            except Exception as e:
                error_count += 1
                print(f"  ✗ Failed to store {video.video_id}: {e}", file=sys.stderr)

    print(f"\nCollection complete!")
    print(f"  Total videos processed: {enriched_count}")
    print(f"  SONG videos: {song_count}")
    print(f"  GAME videos: {game_count}")
    print(f"  UNKNOWN videos: {unknown_count}")
    if error_count:
        raise RuntimeError(f"{error_count} videos failed or remain unresolved; retry with vsxp-enrich")


def main(
    channel_urls: List[str],
    video_urls: List[str] | None = None,
    max_videos: int = 0,
    max_song_videos: int = 0,
    overwrite: bool = False,
    metadata_only: bool = False,
    song_search_results: int = 0,
) -> int:
    """
    Main entry point for the collector.

    Args:
      channel_urls: List of YouTube channel URLs, handles, or IDs to collect
      max_videos: Maximum new videos per channel (0 = no limit)
      max_song_videos: Maximum SONG videos per channel (0 = no limit)
      overwrite: Re-process existing videos (default: False)
    """
    settings = get_collector_settings()

    youtube_client = YouTubeClient(settings.youtube_api_key)
    video_repo = VideoRepository.from_settings(settings)
    index_repo = SingerVideoIndexRepository.from_settings(settings)
    try:
        video_repo.verify_table_access()
        index_repo.verify_table_access()
    except Exception as error:
        print(
            f"DynamoDB is not ready: {type(error).__name__}. "
            "Configure AWS credentials and create both tables before collecting.",
            file=sys.stderr,
        )
        return 1
    gemini_client = GeminiClient(
        settings.gemini_api_key,
        model=settings.gemini_model,
        catalog_path=settings.original_songs_path,
    )
    enricher = VideoEnricher(
        gemini_client,
        video_repo,
        index_repo,
        youtube_client,
        analyze_features=not metadata_only,
        channel_registry_path=settings.channels_path,
    )

    failures = 0
    if video_urls:
        try:
            collect_videos(video_urls, youtube_client, video_repo, enricher, overwrite)
        except Exception as error:
            failures += 1
            print(f"Error collecting explicit videos: {error}", file=sys.stderr)
    for channel_url in channel_urls:
        try:
            # Resolve URL/handle to canonical channel ID
            print(f"Resolving channel: {channel_url}")
            channel_id = youtube_client.resolve_channel_id(channel_url)
            print(f"  → Channel ID: {channel_id}\n")

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
        except ValueError as e:
            failures += 1
            # Invalid format or custom URL
            print(f"Error: {e}", file=sys.stderr)
            continue
        except Exception as e:
            failures += 1
            print(f"Error collecting channel {channel_url}: {e}", file=sys.stderr)
            continue

    return 1 if failures else 0


def cli():
    parser = argparse.ArgumentParser(description="Collect and enrich YouTube videos")
    parser.add_argument(
        "--channel-url", "--channel-id",
        type=str,
        action="append",
        dest="channel_urls",
        help="YouTube channel or video URL, handle, or ID (can be specified multiple times). "
        "Supports: video URLs (/watch?v=xxx, youtu.be/xxx), channel URLs (/channel/UCxxx, "
        "/user/xxx, /@handle), or direct channel ID/handle",
    )
    parser.add_argument(
        "--video-url",
        action="append",
        dest="video_urls",
        help="Collect only this YouTube video (can be specified multiple times)",
    )
    parser.add_argument(
        "--max-videos",
        type=int,
        default=0,
        help="Maximum number of new videos per channel; already stored videos "
        "do not count toward the limit (default: no limit)",
    )
    parser.add_argument(
        "--max-song-videos",
        type=int,
        default=0,
        help="Maximum number of SONG videos to process per channel. "
        "When set, stops processing after enriching N SONG videos, "
        "skipping remaining videos (default: no limit)",
    )
    parser.add_argument(
        "--song-search-results",
        type=int,
        default=0,
        help="Also search each channel for this many likely song videos (default: disabled)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        default=False,
        help="Re-process existing videos. Re-fetches from YouTube and re-enriches with Gemini API. "
        "Existing videos will count toward --max-song-videos limit. "
        "WARNING: This will consume YouTube and Gemini API quota for all videos.",
    )
    parser.add_argument(
        "--metadata-only",
        action="store_true",
        help="Collect grounded song identity without comments, AI characteristics, or chorus analysis",
    )

    args = parser.parse_args()

    if not args.channel_urls and not args.video_urls:
        # Collect every channel registered in the shared channel catalog.
        settings = get_collector_settings()
        registered_channels = load_channel_registry(settings.channels_path)
        if not registered_channels:
            print("Error: No channels are registered", file=sys.stderr)
            print(
                "Run vsxp-register-channel --channel-url URL first", file=sys.stderr
            )
            sys.exit(1)
        args.channel_urls = list(registered_channels)

    return main(
        args.channel_urls or [],
        args.video_urls or [],
        args.max_videos,
        args.max_song_videos,
        args.overwrite,
        args.metadata_only,
        args.song_search_results,
    )


if __name__ == "__main__":
    sys.exit(cli())
