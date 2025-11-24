from typing import Any, Dict, List, Optional, Set

import boto3
from youtube_client import YouTubeVideo


class VideoRecord:
    """Simple video record for enrichment."""

    def __init__(
        self,
        video_id: str,
        video_title: str,
        channel_id: str = "",
        description: str = "",
        duration: Optional[int] = None,
        published_at: str = "",
        song_title: str = "",
        game_title: str = "",
        view_count: int = 0,
        like_count: int = 0,
        comment_count: int = 0,
        channel_title: str = "",
    ):
        self.video_id = video_id
        self.video_title = video_title
        self.channel_id = channel_id
        self.description = description
        self.duration = duration
        self.published_at = published_at
        self.song_title = song_title
        self.game_title = game_title
        self.view_count = view_count
        self.like_count = like_count
        self.comment_count = comment_count
        self.channel_title = channel_title


class VideoRepository:
    """Repository for managing videos in DynamoDB."""

    def __init__(self, client, table_name: str):
        self._client = client
        self._table_name = table_name

    @classmethod
    def from_settings(cls, settings) -> "VideoRepository":
        """Create repository from collector settings."""
        client_kwargs = {"region_name": settings.aws_region}
        if settings.dynamodb_endpoint_url:
            client_kwargs["endpoint_url"] = settings.dynamodb_endpoint_url

        client = boto3.client("dynamodb", **client_kwargs)
        return cls(client, settings.dynamodb_table_videos)

    def list_existing_video_ids(self, channel_id: str) -> Set[str]:
        """
        List all video IDs that already exist in DynamoDB for a channel.

        Args:
          channel_id: YouTube channel ID

        Returns:
          Set of video IDs
        """
        video_ids: Set[str] = set()

        query_kwargs = {
            "TableName": self._table_name,
            "KeyConditionExpression": "channel_id = :channel_id",
            "ExpressionAttributeValues": {":channel_id": {"S": channel_id}},
            "ProjectionExpression": "video_id",
        }

        while True:
            response = self._client.query(**query_kwargs)

            for item in response.get("Items", []):
                video_ids.add(item["video_id"]["S"])

            if "LastEvaluatedKey" in response:
                query_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
            else:
                break

        return video_ids

    def upsert_video(self, video: YouTubeVideo) -> None:
        """
        Insert or update a video record in DynamoDB.

        Args:
          video: YouTubeVideo object to store
        """
        # Skip live streams (duration == 0)
        if video.duration == 0:
            return

        item: Dict[str, Any] = {
            "channel_id": {"S": video.channel_id},
            "video_id": {"S": video.video_id},
            "video_title": {"S": video.title},
            "description": {"S": video.description},
            "duration": {"N": str(video.duration)},
            "published_at": {"S": video.published_at},
            "view_count": {"N": str(video.view_count)},
            "like_count": {"N": str(video.like_count)},
            "comment_count": {"N": str(video.comment_count)},
            "channel_title": {"S": video.channel_title},
        }

        # Add thumbnail URL if available
        if video.thumbnail_url:
            item["thumbnail_url"] = {"S": video.thumbnail_url}

        self._client.put_item(TableName=self._table_name, Item=item)

    def batch_upsert_videos(self, videos: List[YouTubeVideo]) -> None:
        """
        Batch insert/update multiple videos.

        Args:
          videos: List of YouTubeVideo objects
        """
        for video in videos:
            self.upsert_video(video)

    def upsert_channel_info(
        self,
        channel_id: str,
        channel_name: str,
        channel_icon_url: str,
        subscriber_count: int = 0,
    ) -> None:
        """
        Store channel metadata (name, icon URL, and subscriber count).

        Args:
          channel_id: YouTube channel ID
          channel_name: Channel name
          channel_icon_url: Channel icon/avatar URL
          subscriber_count: Number of subscribers
        """
        item: Dict[str, Any] = {
            "channel_id": {"S": channel_id},
            "video_id": {"S": "CHANNEL_INFO"},
            "channel_name": {"S": channel_name},
            "channel_icon_url": {"S": channel_icon_url},
            "subscriber_count": {"N": str(subscriber_count)},
        }

        self._client.put_item(TableName=self._table_name, Item=item)

    def get_video(self, channel_id: str, video_id: str) -> Optional[VideoRecord]:
        """
        Get a single video from DynamoDB.

        Args:
          channel_id: YouTube channel ID
          video_id: YouTube video ID

        Returns:
          VideoRecord or None if not found
        """
        response = self._client.get_item(
            TableName=self._table_name,
            Key={"channel_id": {"S": channel_id}, "video_id": {"S": video_id}},
        )

        item = response.get("Item")
        if not item:
            return None

        return VideoRecord(
            video_id=item["video_id"]["S"],
            video_title=item["video_title"]["S"],
            channel_id=item.get("channel_id", {}).get("S", ""),
            description=item.get("description", {}).get("S", ""),
            duration=int(item["duration"]["N"]) if "duration" in item else None,
            published_at=item.get("published_at", {}).get("S", ""),
            song_title=item.get("song_title", {}).get("S", ""),
            game_title=item.get("game_title", {}).get("S", ""),
        )

    def list_videos_by_channel(self, channel_id: str) -> List[VideoRecord]:
        """
        List all videos for a channel.

        Args:
          channel_id: YouTube channel ID

        Returns:
          List of VideoRecord objects
        """
        videos: List[VideoRecord] = []

        query_kwargs = {
            "TableName": self._table_name,
            "KeyConditionExpression": "channel_id = :channel_id",
            "ExpressionAttributeValues": {":channel_id": {"S": channel_id}},
        }

        while True:
            response = self._client.query(**query_kwargs)

            for item in response.get("Items", []):
                videos.append(
                    VideoRecord(
                        video_id=item["video_id"]["S"],
                        video_title=item["video_title"]["S"],
                        channel_id=item.get("channel_id", {}).get("S", ""),
                        description=item.get("description", {}).get("S", ""),
                        duration=(
                            int(item["duration"]["N"]) if "duration" in item else None
                        ),
                        published_at=item.get("published_at", {}).get("S", ""),
                        song_title=item.get("song_title", {}).get("S", ""),
                        game_title=item.get("game_title", {}).get("S", ""),
                    )
                )

            if "LastEvaluatedKey" in response:
                query_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
            else:
                break

        return videos

    def update_video_type(
        self, channel_id: str, video_id: str, video_type: str
    ) -> None:
        """
        Update only the video_type attribute.

        Args:
          channel_id: YouTube channel ID
          video_id: YouTube video ID
          video_type: Video type (SONG/GAME/UNKNOWN)
        """
        self._client.update_item(
            TableName=self._table_name,
            Key={"channel_id": {"S": channel_id}, "video_id": {"S": video_id}},
            UpdateExpression="SET video_type = :video_type",
            ExpressionAttributeValues={":video_type": {"S": video_type}},
        )

    def update_song_info(
        self,
        channel_id: str,
        video_id: str,
        song_title: str,
        singers: List[str],
        is_cover: bool,
        link: Optional[str] = None,
        ai_stats: Optional[Dict[str, int]] = None,
        comment_cloud: Optional[List[Dict[str, Any]]] = None,
        chorus_start_time: Optional[int] = None,
        chorus_end_time: Optional[int] = None,
    ) -> None:
        """
        Update song-related attributes.

        Args:
          channel_id: YouTube channel ID
          video_id: YouTube video ID
          song_title: Song title
          singers: List of singer names
          is_cover: Whether this is a cover song
          link: Optional link to original song
          ai_stats: Optional AI characteristics (cool, cute, energetic, surprising, emotional)
          comment_cloud: Optional comment keywords with importance
          chorus_start_time: Optional chorus start time in seconds
          chorus_end_time: Optional chorus end time in seconds
        """
        update_expr = (
            "SET video_type = :video_type, song_title = :song_title, "
            "singers = :singers, is_cover = :is_cover"
        )
        attr_values = {
            ":video_type": {"S": "SONG"},
            ":song_title": {"S": song_title},
            ":singers": {"L": [{"S": singer} for singer in singers]},
            ":is_cover": {"BOOL": is_cover},
        }

        if link:
            update_expr += ", link = :link"
            attr_values[":link"] = {"S": link}

        if ai_stats:
            update_expr += ", ai_stats = :ai_stats"
            attr_values[":ai_stats"] = {
                "M": {
                    "cool": {"N": str(ai_stats["cool"])},
                    "cute": {"N": str(ai_stats["cute"])},
                    "energetic": {"N": str(ai_stats["energetic"])},
                    "surprising": {"N": str(ai_stats["surprising"])},
                    "emotional": {"N": str(ai_stats["emotional"])},
                }
            }

        if comment_cloud:
            update_expr += ", comment_cloud = :comment_cloud"
            attr_values[":comment_cloud"] = {
                "L": [
                    {
                        "M": {
                            "word": {"S": kw["word"]},
                            "importance": {"N": str(kw["importance"])},
                        }
                    }
                    for kw in comment_cloud
                ]
            }

        if chorus_start_time is not None and chorus_end_time is not None:
            update_expr += ", chorus_start_time = :chorus_start_time"
            update_expr += ", chorus_end_time = :chorus_end_time"
            attr_values[":chorus_start_time"] = {"N": str(chorus_start_time)}
            attr_values[":chorus_end_time"] = {"N": str(chorus_end_time)}

        self._client.update_item(
            TableName=self._table_name,
            Key={"channel_id": {"S": channel_id}, "video_id": {"S": video_id}},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=attr_values,
        )


def normalize(text: str) -> str:
    """
    Normalize text for use as a DynamoDB key.

    Args:
      text: Text to normalize

    Returns:
      Normalized text (lowercase, trimmed)
    """
    return text.lower().strip()


class SingerVideoIndexRepository:
    """Repository for managing the singer-videos index table."""

    def __init__(self, client, table_name: str):
        self._client = client
        self._table_name = table_name

    @classmethod
    def from_settings(cls, settings) -> "SingerVideoIndexRepository":
        """Create repository from collector settings."""
        client_kwargs = {"region_name": settings.aws_region}
        if settings.dynamodb_endpoint_url:
            client_kwargs["endpoint_url"] = settings.dynamodb_endpoint_url

        client = boto3.client("dynamodb", **client_kwargs)
        return cls(client, settings.dynamodb_table_singer_videos)

    def delete_singer_video_index(self, video_id: str) -> None:
        """
        Delete all singer-video index records for a given video.

        Args:
          video_id: YouTube video ID
        """
        # Query GSI_VIDEO_ID to find all records for this video
        response = self._client.query(
            TableName=self._table_name,
            IndexName="GSI_VIDEO_ID",
            KeyConditionExpression="video_id = :video_id",
            ExpressionAttributeValues={":video_id": {"S": video_id}},
        )

        items = response.get("Items", [])

        # Delete each record
        for item in items:
            self._client.delete_item(
                TableName=self._table_name,
                Key={
                    "singer_key": item["singer_key"],
                    "sort_key": item["sort_key"],
                },
            )

    def upsert_singer_video_index(
        self,
        video_id: str,
        channel_id: str,
        video_title: str,
        song_title: str,
        singers: List[str],
        published_at: str,
        is_cover: bool,
        link: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        original_song_title: Optional[str] = None,
        original_artist_name: Optional[str] = None,
        ai_stats: Optional[Dict[str, int]] = None,
        comment_cloud: Optional[List[Dict[str, Any]]] = None,
        chorus_start_time: Optional[int] = None,
        chorus_end_time: Optional[int] = None,
        view_count: int = 0,
        like_count: int = 0,
        comment_count: int = 0,
        channel_title: str = "",
        subscriber_count: int = 0,
    ) -> None:
        """
        Create or update singer-video index records.

        Creates one record per singer for the given video.

        Args:
          video_id: YouTube video ID
          channel_id: YouTube channel ID
          video_title: YouTube video title
          song_title: Song title (enriched)
          singers: List of singer names
          published_at: Publication timestamp (ISO 8601)
          is_cover: Whether this is a cover song
          link: Link to original song (optional)
          thumbnail_url: Video thumbnail URL (optional)
          original_song_title: Original song title (optional)
          original_artist_name: Original artist name (optional)
          ai_stats: Optional AI characteristics (cool, cute, energetic, surprising, emotional)
          comment_cloud: Optional comment keywords with importance
          chorus_start_time: Optional chorus start time in seconds
          chorus_end_time: Optional chorus end time in seconds
          view_count: View count (default: 0)
          like_count: Like count (default: 0)
          comment_count: Comment count (default: 0)
          channel_title: Channel title (default: "")
          subscriber_count: Subscriber count (default: 0)
        """
        # Build song_key from original song info
        if original_song_title and original_artist_name:
            song_key = (
                f"{normalize(original_song_title)}\t{normalize(original_artist_name)}"
            )
        else:
            # Fallback: use song_title as both title and artist
            song_key = f"{normalize(song_title)}\t{normalize(song_title)}"

        sort_key = f"{published_at}#{video_id}"

        # Create one record per singer
        for singer_name in singers:
            singer_key = normalize(singer_name)

            item: Dict[str, Any] = {
                "singer_key": {"S": singer_key},
                "sort_key": {"S": sort_key},
                "singer_name": {"S": singer_name},
                "song_key": {"S": song_key},
                "video_id": {"S": video_id},
                "song_title": {"S": song_title},
                "video_title": {"S": video_title},
                "channel_id": {"S": channel_id},
                "published_at": {"S": published_at},
                "is_cover": {"BOOL": is_cover},
            }

            if link:
                item["link"] = {"S": link}
            if thumbnail_url:
                item["thumbnail_url"] = {"S": thumbnail_url}
            if original_song_title:
                item["original_song_title"] = {"S": original_song_title}
            if original_artist_name:
                item["original_artist_name"] = {"S": original_artist_name}
            if ai_stats:
                item["ai_stats"] = {
                    "M": {
                        "cool": {"N": str(ai_stats["cool"])},
                        "cute": {"N": str(ai_stats["cute"])},
                        "energetic": {"N": str(ai_stats["energetic"])},
                        "surprising": {"N": str(ai_stats["surprising"])},
                        "emotional": {"N": str(ai_stats["emotional"])},
                    }
                }
            if comment_cloud:
                item["comment_cloud"] = {
                    "L": [
                        {
                            "M": {
                                "word": {"S": kw["word"]},
                                "importance": {"N": str(kw["importance"])},
                            }
                        }
                        for kw in comment_cloud
                    ]
                }
            if chorus_start_time is not None:
                item["chorus_start_time"] = {"N": str(chorus_start_time)}
            if chorus_end_time is not None:
                item["chorus_end_time"] = {"N": str(chorus_end_time)}

            # Add statistics fields
            item["view_count"] = {"N": str(view_count)}
            item["like_count"] = {"N": str(like_count)}
            item["comment_count"] = {"N": str(comment_count)}
            item["channel_title"] = {"S": channel_title}
            item["subscriber_count"] = {"N": str(subscriber_count)}

            self._client.put_item(TableName=self._table_name, Item=item)
