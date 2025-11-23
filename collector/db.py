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
    ):
        self.video_id = video_id
        self.video_title = video_title
        self.channel_id = channel_id
        self.description = description
        self.duration = duration
        self.published_at = published_at
        self.song_title = song_title
        self.game_title = game_title


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
        self, channel_id: str, channel_name: str, channel_icon_url: str
    ) -> None:
        """
        Store channel metadata (name and icon URL).

        Args:
          channel_id: YouTube channel ID
          channel_name: Channel name
          channel_icon_url: Channel icon/avatar URL
        """
        item: Dict[str, Any] = {
            "channel_id": {"S": channel_id},
            "video_id": {"S": "CHANNEL_INFO"},
            "channel_name": {"S": channel_name},
            "channel_icon_url": {"S": channel_icon_url},
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

        self._client.update_item(
            TableName=self._table_name,
            Key={"channel_id": {"S": channel_id}, "video_id": {"S": video_id}},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=attr_values,
        )
