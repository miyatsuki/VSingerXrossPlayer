from typing import List, Optional

import boto3

try:
    # Imported as backend.db.dynamo
    from ..config import Settings
    from ..models import SingerSummary, Video
    from . import VideoRepository
except ImportError:
    # Imported as db.dynamo (top-level)
    from config import Settings
    from db import VideoRepository
    from models import SingerSummary, Video


class DynamoVideoRepository(VideoRepository):
    def __init__(self, client, table_name: str):
        self._client = client
        self._table_name = table_name

    @classmethod
    def from_settings(cls, settings: Settings) -> "DynamoVideoRepository":
        client_kwargs = {"region_name": settings.aws_region}
        if settings.dynamodb_endpoint_url:
            client_kwargs["endpoint_url"] = settings.dynamodb_endpoint_url
        client = boto3.client("dynamodb", **client_kwargs)
        return cls(client, settings.dynamodb_table_videos)

    def _parse_list(self, value) -> List[str]:
        if not value or "L" not in value:
            return []
        return [v.get("S", "") for v in value["L"] if isinstance(v, dict)]

    def _item_to_video(self, item: dict) -> Video:
        return Video(
            video_id=item["video_id"]["S"],
            video_title=item["video_title"]["S"],
            channel_id=item.get("channel_id", {}).get("S"),
            description=item.get("description", {}).get("S"),
            duration=int(item["duration"]["N"]) if "duration" in item else None,
            published_at=item.get("published_at", {}).get("S"),
            song_title=item.get("song_title", {}).get("S"),
            singers=self._parse_list(item.get("singers")),
            tags=self._parse_list(item.get("tags")),
            is_cover=item.get("is_cover", {}).get("BOOL"),
            link=item.get("link", {}).get("S"),
            game_title=item.get("game_title", {}).get("S"),
            genre=item.get("genre", {}).get("S"),
        )

    def list_videos(
        self,
        q: Optional[str] = None,
        singer: Optional[str] = None,
        tag: Optional[str] = None,
        limit: int = 50,
    ) -> List[Video]:
        scan_kwargs = {"TableName": self._table_name}

        # Build filter expression parts
        filter_parts = []
        expr_attr_values = {}

        # Filter out CHANNEL_INFO items (not actual videos)
        filter_parts.append("video_id <> :channel_info")
        expr_attr_values[":channel_info"] = {"S": "CHANNEL_INFO"}

        if q:
            filter_parts.append(
                "(contains(video_title, :q) OR contains(description, :q))"
            )
            expr_attr_values[":q"] = {"S": q}

        if singer:
            filter_parts.append("contains(singers, :singer)")
            expr_attr_values[":singer"] = {"S": singer}

        if tag:
            filter_parts.append("contains(tags, :tag)")
            expr_attr_values[":tag"] = {"S": tag}

        # Combine filter parts with AND
        if filter_parts:
            scan_kwargs["FilterExpression"] = " AND ".join(filter_parts)
            scan_kwargs["ExpressionAttributeValues"] = expr_attr_values

        response = self._client.scan(**scan_kwargs)
        items = response.get("Items", [])
        videos = [self._item_to_video(item) for item in items]
        return videos[:limit]

    def get_video(self, video_id: str) -> Optional[Video]:
        scan_kwargs = {
            "TableName": self._table_name,
            "FilterExpression": "video_id = :video_id",
            "ExpressionAttributeValues": {":video_id": {"S": video_id}},
            "Limit": 1,
        }
        response = self._client.scan(**scan_kwargs)
        items = response.get("Items", [])
        if not items:
            return None
        return self._item_to_video(items[0])

    def list_singers(self) -> List[SingerSummary]:
        response = self._client.scan(TableName=self._table_name)
        items = response.get("Items", [])
        counts = {}
        latest_ids = {}
        for item in items:
            # Skip CHANNEL_INFO items
            video_id = item.get("video_id", {}).get("S")
            if video_id == "CHANNEL_INFO":
                continue

            singers = self._parse_list(item.get("singers"))
            for name in singers:
                counts[name] = counts.get(name, 0) + 1
                latest_ids.setdefault(name, video_id)
        summaries = [
            SingerSummary(
                name=name, video_count=count, latest_video_id=latest_ids.get(name)
            )
            for name, count in counts.items()
        ]
        summaries.sort(key=lambda s: s.name.lower())
        return summaries
