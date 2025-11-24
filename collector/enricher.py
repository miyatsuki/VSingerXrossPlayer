"""
Video enricher using Gemini API.

Enriches video metadata with:
1. Video type classification (SONG/GAME/UNKNOWN)
2. Song information extraction (title, singers, artists)
3. AI characteristics analysis (cool, cute, energetic, surprising, emotional)
4. Comment keyword extraction
"""

from typing import Optional

from db import SingerVideoIndexRepository
from gemini_client import GeminiClient
from youtube_client import YouTubeClient

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
        youtube_client: Optional[YouTubeClient] = None,
    ):
        self.gemini = gemini_client
        self.repo = video_repo
        self.index_repo = index_repo
        self.youtube = youtube_client

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

        # 4.5. Analyze AI characteristics and extract comment keywords
        ai_stats = None
        comment_cloud = None
        chorus_info = None

        if self.youtube:
            try:
                # Fetch comments
                print(f"  → Fetching comments...")
                comments = self.youtube.fetch_video_comments(video_id, max_results=100)
                print(f"  → Found {len(comments)} comments")

                if comments:
                    # Analyze video characteristics (5-axis)
                    print(f"  → Analyzing AI characteristics...")
                    ai_stats = self.gemini.analyze_video_characteristics(
                        video_id, comments
                    )
                    print(
                        f"  → AI Stats: Cool={ai_stats['cool']}, Cute={ai_stats['cute']}, "
                        f"Energetic={ai_stats['energetic']}, Surprising={ai_stats['surprising']}, "
                        f"Emotional={ai_stats['emotional']}"
                    )

                    # Extract comment keywords
                    print(f"  → Extracting comment keywords...")
                    keywords = self.gemini.extract_comment_keywords(comments)
                    comment_cloud = [
                        {"word": kw["word"], "importance": kw["importance"]}
                        for kw in keywords
                    ]
                    print(
                        f"  → Extracted {len(comment_cloud)} keywords: "
                        f"{', '.join([kw['word'] for kw in comment_cloud[:5]])}"
                    )

                # Extract chorus timestamps
                print(f"  → Extracting chorus timestamps...")
                chorus_result = self.gemini.extract_chorus_time(video_id)

                if chorus_result["confidence"] > 0.5:  # Only use if confidence > 50%
                    chorus_info = {
                        "start": chorus_result["chorus_start_time"],
                        "end": chorus_result["chorus_end_time"],
                    }
                    print(
                        f"  → Chorus: {chorus_info['start']}s - {chorus_info['end']}s "
                        f"(confidence: {chorus_result['confidence']:.2f})"
                    )
                else:
                    print(
                        f"  → Chorus detection failed (low confidence: {chorus_result['confidence']:.2f})"
                    )

            except Exception as e:
                print(f"  ⚠ AI analysis failed: {e}")
                # Continue without AI stats

        # 5. Update DynamoDB with enriched information
        self.repo.update_song_info(
            channel_id=channel_id,
            video_id=video_id,
            song_title=song_info["song_title"],
            singers=song_info["singers"],
            is_cover=song_info["is_cover"],
            link=song_info.get("original_url"),
            ai_stats=ai_stats,
            comment_cloud=comment_cloud,
            chorus_start_time=chorus_info["start"] if chorus_info else None,
            chorus_end_time=chorus_info["end"] if chorus_info else None,
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
                    ai_stats=ai_stats,
                    comment_cloud=comment_cloud,
                    chorus_start_time=chorus_info["start"] if chorus_info else None,
                    chorus_end_time=chorus_info["end"] if chorus_info else None,
                    view_count=getattr(video, "view_count", 0),
                    like_count=getattr(video, "like_count", 0),
                    comment_count=getattr(video, "comment_count", 0),
                    channel_title=getattr(video, "channel_title", ""),
                    subscriber_count=0,  # TODO: Fetch from channel info
                )
                print(f"  → Synced to index table")
            except Exception as e:
                print(f"  ✗ Index sync failed: {e}")
                # Don't fail the whole enrichment if index sync fails

        return True
