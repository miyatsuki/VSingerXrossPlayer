from typing import Any, Dict, List, Set

import boto3

from .youtube_client import YouTubeVideo


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

        self._client.put_item(TableName=self._table_name, Item=item)

    def batch_upsert_videos(self, videos: List[YouTubeVideo]) -> None:
        """
        Batch insert/update multiple videos.

        Args:
          videos: List of YouTubeVideo objects
        """
        for video in videos:
            self.upsert_video(video)
