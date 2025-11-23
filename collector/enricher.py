"""
Video enricher using Gemini API.

Enriches video metadata with:
1. Video type classification (SONG/GAME/UNKNOWN)
2. Song information extraction (title, singers, artists)
"""

from typing import Optional

from db import SingerVideoIndexRepository
from gemini_client import GeminiClient

# Duration thresholds (in seconds)
DURATION_MIN = 60  # Exclude Shorts (< 1 minute)
DURATION_MAX = 60 * 20  # Exclude live streams (> 20 minutes)


class VideoEnricher:
    """Enriches video metadata using Gemini API."""

    def __init__(
        self,
        gemini_client: GeminiClient,
        video_repo,
        index_repo: Optional[SingerVideoIndexRepository] = None,
    ):
        self.gemini = gemini_client
        self.repo = video_repo
        self.index_repo = index_repo

    def enrich_video(
        self, channel_id: str, video_id: str, channel_name: Optional[str] = None
    ) -> bool:
        """
        Enrich a single video with AI-generated metadata.

        Args:
          channel_id: YouTube channel ID
          video_id: YouTube video ID
          channel_name: Optional channel name for better extraction

        Returns:
          True if enrichment was successful, False otherwise
        """
        # 1. Get video from DynamoDB
        video = self.repo.get_video(channel_id, video_id)
        if not video:
            print(f"Video not found: {video_id}")
            return False

        # 2. Filter by duration
        if video.duration is None:
            print(f"Skipping {video_id}: no duration")
            return False

        if not (DURATION_MIN <= video.duration <= DURATION_MAX):
            print(
                f"Skipping {video_id}: duration {video.duration}s out of range "
                f"({DURATION_MIN}-{DURATION_MAX}s)"
            )
            # Update with UNKNOWN type to mark as processed
            self.repo.update_video_type(channel_id, video_id, "UNKNOWN")
            return False

        # 3. Classify video type
        print(f"Classifying {video_id}: {video.video_title[:50]}...")
        video_type_result = self.gemini.classify_video_type(
            video.video_title, video.description or ""
        )

        video_type = video_type_result["type"]
        confidence = video_type_result["confidence"]

        print(
            f"  → Type: {video_type} (confidence: {confidence:.2f}) "
            f"- {video_type_result['reason']}"
        )

        if video_type != "SONG":
            # Not a song video, just update type
            self.repo.update_video_type(channel_id, video_id, video_type)
            return True

        # 4. Extract song information
        print(f"Extracting song info for {video_id}...")
        song_info = self.gemini.extract_song_info(
            video.video_title, video.description or "", channel_name or ""
        )

        if not song_info.get("song_title"):
            print(f"  → Failed to extract song title")
            # Mark as SONG but without detailed info
            self.repo.update_video_type(channel_id, video_id, "SONG")
            return False

        print(f"  → Song: {song_info['song_title']}")
        print(f"  → Singers: {', '.join(song_info['singers'])}")
        print(f"  → Cover: {song_info['is_cover']}")

        # 5. Update DynamoDB with enriched information
        self.repo.update_song_info(
            channel_id=channel_id,
            video_id=video_id,
            song_title=song_info["song_title"],
            singers=song_info["singers"],
            is_cover=song_info["is_cover"],
            link=song_info.get("original_url"),
        )

        # 6. Sync to singer-videos index table
        if self.index_repo:
            try:
                # Delete existing index entries for this video
                self.index_repo.delete_singer_video_index(video_id)

                # Extract original artist name (first artist from list)
                original_artists = song_info.get("original_artists", [])
                original_artist_name = original_artists[0] if original_artists else None

                # Create new index entries
                self.index_repo.upsert_singer_video_index(
                    video_id=video_id,
                    channel_id=channel_id,
                    video_title=video.video_title,
                    song_title=song_info["song_title"],
                    singers=song_info["singers"],
                    published_at=video.published_at,
                    is_cover=song_info["is_cover"],
                    link=song_info.get("original_url"),
                    thumbnail_url=getattr(video, "thumbnail_url", None),
                    original_song_title=song_info[
                        "song_title"
                    ],  # Use song_title as original
                    original_artist_name=original_artist_name,
                )
                print(f"  → Synced to index table")
            except Exception as e:
                print(f"  ✗ Index sync failed: {e}")
                # Don't fail the whole enrichment if index sync fails

        return True
