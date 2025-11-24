from typing import Any, Dict, List, Set

import isodate
import requests
from url_parser import IdentifierType, parse_youtube_url

BASE_URL = "https://www.googleapis.com/youtube/v3"


class YouTubeVideo:
    """Represents a YouTube video with metadata."""

    def __init__(
        self,
        video_id: str,
        channel_id: str,
        title: str,
        description: str,
        duration: int,
        published_at: str,
        thumbnail_url: str = "",
        view_count: int = 0,
        like_count: int = 0,
        comment_count: int = 0,
        channel_title: str = "",
    ):
        self.video_id = video_id
        self.channel_id = channel_id
        self.title = title
        self.description = description
        self.duration = duration
        self.published_at = published_at
        self.thumbnail_url = thumbnail_url
        self.view_count = view_count
        self.like_count = like_count
        self.comment_count = comment_count
        self.channel_title = channel_title


class YouTubeClient:
    """Client for YouTube Data API v3."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    def _get(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make a GET request to YouTube API."""
        params["key"] = self.api_key
        url = f"{BASE_URL}/{endpoint}"
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()

    def resolve_channel_id(self, url_or_id: str) -> str:
        """
        Resolve any YouTube identifier to a canonical channel ID.

        Supports multiple formats:
        - https://www.youtube.com/watch?v=xxx (resolves video to channel)
        - https://youtu.be/xxx (resolves video to channel)
        - https://www.youtube.com/channel/UCxxxx (extracts channel ID)
        - https://www.youtube.com/user/username (resolves via API)
        - https://www.youtube.com/@handle (resolves via API)
        - Direct channel ID: UCxxxx (returns as-is)
        - Direct handle: @handle (resolves via API)

        Args:
            url_or_id: YouTube URL, channel ID, username, handle, or video URL

        Returns:
            Canonical YouTube channel ID

        Raises:
            ValueError: If the format is invalid or custom URL is provided
        """
        identifier_type, identifier = parse_youtube_url(url_or_id)

        if identifier_type == IdentifierType.CHANNEL_ID:
            # Already a channel ID, return as-is
            return identifier

        elif identifier_type == IdentifierType.USERNAME:
            # Resolve username to channel ID
            return self._fetch_channel_by_username(identifier)

        elif identifier_type == IdentifierType.HANDLE:
            # Resolve handle to channel ID
            return self._fetch_channel_by_handle(identifier)

        elif identifier_type == IdentifierType.VIDEO_ID:
            # Resolve video ID to channel ID
            channel_id, channel_name = self._fetch_channel_by_video_id(identifier)
            print(f"  → Video belongs to: {channel_name}")
            return channel_id

        elif identifier_type == IdentifierType.CUSTOM_URL:
            # Custom URLs cannot be resolved via API
            raise ValueError(
                f"Custom URL (/c/{identifier}) cannot be resolved via YouTube API.\n"
                f"Please visit https://www.youtube.com/c/{identifier} in a browser\n"
                f"and copy the channel ID from the URL (it will redirect to /channel/UCxxxx)"
            )

        else:
            raise ValueError(f"Unsupported identifier type: {identifier_type}")

    def _fetch_channel_by_username(self, username: str) -> str:
        """
        Fetch channel ID by username using forUsername parameter.

        Args:
            username: YouTube username (from /user/xxx URLs)

        Returns:
            Channel ID

        Raises:
            ValueError: If channel is not found
        """
        result = self._get(
            "channels",
            {
                "forUsername": username,
                "part": "id",
            },
        )

        if not result.get("items"):
            raise ValueError(f"Channel not found for username: {username}")

        return result["items"][0]["id"]

    def _fetch_channel_by_handle(self, handle: str) -> str:
        """
        Fetch channel ID by handle using forHandle parameter.

        Args:
            handle: YouTube handle (without @ prefix, from /@xxx URLs)

        Returns:
            Channel ID

        Raises:
            ValueError: If channel is not found
        """
        result = self._get(
            "channels",
            {
                "forHandle": handle,
                "part": "id",
            },
        )

        if not result.get("items"):
            raise ValueError(f"Channel not found for handle: @{handle}")

        return result["items"][0]["id"]

    def _fetch_channel_by_video_id(self, video_id: str) -> tuple[str, str]:
        """
        Fetch channel ID and name by video ID.

        Args:
            video_id: YouTube video ID (from /watch?v=xxx or youtu.be/xxx URLs)

        Returns:
            Tuple of (channel_id, channel_name)

        Raises:
            ValueError: If video is not found
        """
        result = self._get(
            "videos",
            {
                "id": video_id,
                "part": "snippet",
            },
        )

        if not result.get("items"):
            raise ValueError(f"Video not found: {video_id}")

        snippet = result["items"][0]["snippet"]
        return (snippet["channelId"], snippet["channelTitle"])

    def fetch_uploads_playlist_id(self, channel_id: str) -> str:
        """Get the uploads playlist ID for a channel."""
        result = self._get(
            "channels",
            {
                "id": channel_id,
                "part": "contentDetails",
            },
        )

        if not result.get("items"):
            raise ValueError(f"Channel not found: {channel_id}")

        return result["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]

    def fetch_channel_info(self, channel_id: str) -> Dict[str, Any]:
        """
        Get channel information (name, icon URL, and subscriber count).

        Args:
          channel_id: YouTube channel ID

        Returns:
          Dict with "channel_name", "channel_icon_url", and "subscriber_count"
        """
        result = self._get(
            "channels",
            {
                "id": channel_id,
                "part": "snippet,statistics",
            },
        )

        if not result.get("items"):
            raise ValueError(f"Channel not found: {channel_id}")

        snippet = result["items"][0]["snippet"]
        statistics = result["items"][0].get("statistics", {})
        subscriber_count = int(statistics.get("subscriberCount", 0))

        thumbnails = snippet.get("thumbnails", {})

        # Prefer high quality icon, fallback to medium/default
        icon_url = (
            thumbnails.get("high", {}).get("url", "")
            or thumbnails.get("medium", {}).get("url", "")
            or thumbnails.get("default", {}).get("url", "")
        )

        return {
            "channel_name": snippet.get("title", ""),
            "channel_icon_url": icon_url,
            "subscriber_count": subscriber_count,
        }

    def fetch_video_ids_from_playlist(
        self, playlist_id: str, page_token: str = ""
    ) -> Dict[str, Any]:
        """Fetch video IDs from a playlist (one page)."""
        params = {
            "playlistId": playlist_id,
            "part": "contentDetails",
            "maxResults": "50",
        }
        if page_token:
            params["pageToken"] = page_token

        return self._get("playlistItems", params)

    def fetch_video_ids_from_channel(
        self, channel_id: str, max_videos: int = 0
    ) -> Set[str]:
        """
        Fetch all video IDs from a channel's uploads playlist.

        Args:
          channel_id: YouTube channel ID
          max_videos: Maximum number of videos to fetch (0 = no limit)

        Returns:
          Set of video IDs
        """
        playlist_id = self.fetch_uploads_playlist_id(channel_id)

        video_ids: Set[str] = set()
        page_token = ""

        while True:
            result = self.fetch_video_ids_from_playlist(playlist_id, page_token)

            if "items" not in result:
                break

            for item in result["items"]:
                video_ids.add(item["contentDetails"]["videoId"])

                if max_videos > 0 and len(video_ids) >= max_videos:
                    return video_ids

            if "nextPageToken" in result:
                page_token = result["nextPageToken"]
            else:
                break

        return video_ids

    def fetch_videos(self, video_ids: List[str]) -> List[YouTubeVideo]:
        """
        Fetch detailed video information for given video IDs.

        Args:
          video_ids: List of video IDs (max 50 per request)

        Returns:
          List of YouTubeVideo objects
        """
        if not video_ids:
            return []

        result = self._get(
            "videos",
            {
                "id": ",".join(video_ids[:50]),
                "part": "snippet,contentDetails,statistics",
            },
        )

        videos = []
        for item in result.get("items", []):
            duration_str = item["contentDetails"]["duration"]
            duration_seconds = int(isodate.parse_duration(duration_str).total_seconds())

            # Extract thumbnail URL (prefer high quality, fallback to medium/default)
            thumbnails = item["snippet"].get("thumbnails", {})
            thumbnail_url = (
                thumbnails.get("high", {}).get("url", "")
                or thumbnails.get("medium", {}).get("url", "")
                or thumbnails.get("default", {}).get("url", "")
            )

            # Extract statistics
            stats = item.get("statistics", {})
            view_count = int(stats.get("viewCount", 0))
            like_count = int(stats.get("likeCount", 0))
            comment_count = int(stats.get("commentCount", 0))

            # Extract channel title
            channel_title = item["snippet"].get("channelTitle", "")

            videos.append(
                YouTubeVideo(
                    video_id=item["id"],
                    channel_id=item["snippet"]["channelId"],
                    title=item["snippet"]["title"],
                    description=item["snippet"]["description"],
                    duration=duration_seconds,
                    published_at=item["snippet"]["publishedAt"],
                    thumbnail_url=thumbnail_url,
                    view_count=view_count,
                    like_count=like_count,
                    comment_count=comment_count,
                    channel_title=channel_title,
                )
            )

        return videos

    def fetch_video_comments(
        self, video_id: str, max_results: int = 100
    ) -> List[Dict[str, str]]:
        """
        Fetch comments for a video.

        Args:
          video_id: YouTube video ID
          max_results: Maximum number of comments to fetch (default: 100)

        Returns:
          List of dicts with "text" and "likeCount" keys
        """
        try:
            result = self._get(
                "commentThreads",
                {
                    "videoId": video_id,
                    "part": "snippet",
                    "maxResults": min(max_results, 100),
                    "order": "relevance",  # Most relevant comments first
                    "textFormat": "plainText",
                },
            )

            comments = []
            for item in result.get("items", []):
                snippet = item["snippet"]["topLevelComment"]["snippet"]
                comments.append(
                    {
                        "text": snippet["textDisplay"],
                        "likeCount": snippet.get("likeCount", 0),
                    }
                )

            return comments

        except Exception as e:
            # Comments may be disabled for the video
            print(f"  ℹ Could not fetch comments for {video_id}: {e}")
            return []
