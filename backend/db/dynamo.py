from typing import List, Optional

import boto3
from config import Settings
from models import AIStats, CommentWord, SingerSummary, Video


def normalize(text: str) -> str:
    """Normalize text for DynamoDB key matching."""
    return text.lower().strip()


class DynamoVideoRepository:
    def __init__(self, client, videos_table: str, singer_videos_table: str):
        self._client = client
        self._videos_table = videos_table
        self._singer_videos_table = singer_videos_table

    @classmethod
    def from_settings(cls, settings: Settings) -> "DynamoVideoRepository":
        client_kwargs = {"region_name": settings.aws_region}
        if settings.dynamodb_endpoint_url:
            client_kwargs["endpoint_url"] = settings.dynamodb_endpoint_url
        client = boto3.client("dynamodb", **client_kwargs)
        return cls(
            client,
            settings.dynamodb_table_videos,
            settings.dynamodb_table_singer_videos,
        )

    def _parse_list(self, value) -> List[str]:
        if not value or "L" not in value:
            return []
        return [v.get("S", "") for v in value["L"] if isinstance(v, dict)]

    def _parse_ai_stats(self, value) -> Optional[AIStats]:
        """Parse AI stats from DynamoDB Map structure."""
        if not value or "M" not in value:
            return None
        stats_map = value["M"]
        try:
            return AIStats(
                cool=int(stats_map.get("cool", {}).get("N", 50)),
                cute=int(stats_map.get("cute", {}).get("N", 50)),
                energetic=int(stats_map.get("energetic", {}).get("N", 50)),
                surprising=int(stats_map.get("surprising", {}).get("N", 50)),
                emotional=int(stats_map.get("emotional", {}).get("N", 50)),
            )
        except (ValueError, KeyError):
            return None

    def _parse_comment_cloud(self, value) -> Optional[List[CommentWord]]:
        """Parse comment cloud from DynamoDB List structure."""
        if not value or "L" not in value:
            return None
        try:
            words = []
            for item in value["L"]:
                if "M" in item:
                    word_map = item["M"]
                    words.append(
                        CommentWord(
                            word=word_map.get("word", {}).get("S", ""),
                            importance=int(word_map.get("importance", {}).get("N", 0)),
                        )
                    )
            return words if words else None
        except (ValueError, KeyError):
            return None

    def _singer_video_item_to_video(self, item: dict) -> Video:
        """Convert singer-video index item to Video object."""
        return Video(
            video_id=item["video_id"]["S"],
            video_title=item["video_title"]["S"],
            channel_id=item.get("channel_id", {}).get("S"),
            description=None,  # Not stored in index table
            duration=None,  # Not stored in index table
            published_at=item.get("published_at", {}).get("S"),
            song_title=item.get("song_title", {}).get("S"),
            singers=[
                item.get("singer_name", {}).get("S", "")
            ],  # Single singer per record
            tags=[],
            is_cover=item.get("is_cover", {}).get("BOOL"),
            link=item.get("link", {}).get("S"),
            game_title=None,
            genre=None,
            ai_stats=self._parse_ai_stats(item.get("ai_stats")),
            comment_cloud=self._parse_comment_cloud(item.get("comment_cloud")),
            chorus_start_time=(
                int(item["chorus_start_time"]["N"])
                if "chorus_start_time" in item
                else None
            ),
            chorus_end_time=(
                int(item["chorus_end_time"]["N"]) if "chorus_end_time" in item else None
            ),
        )

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
            ai_stats=self._parse_ai_stats(item.get("ai_stats")),
            comment_cloud=self._parse_comment_cloud(item.get("comment_cloud")),
            chorus_start_time=(
                int(item["chorus_start_time"]["N"])
                if "chorus_start_time" in item
                else None
            ),
            chorus_end_time=(
                int(item["chorus_end_time"]["N"]) if "chorus_end_time" in item else None
            ),
        )

    def list_videos(
        self,
        q: Optional[str] = None,
        singer: Optional[str] = None,
        tag: Optional[str] = None,
        limit: int = 50,
    ) -> List[Video]:
        # Use singer-videos table for optimized singer query
        if singer:
            singer_key = normalize(singer)
            response = self._client.query(
                TableName=self._singer_videos_table,
                KeyConditionExpression="singer_key = :singer_key",
                ExpressionAttributeValues={":singer_key": {"S": singer_key}},
                ScanIndexForward=False,  # Newest first
                Limit=limit * 2,  # Get more to account for deduplication
            )

            items = response.get("Items", [])

            # Group by video_id and merge singers
            video_map = {}
            for item in items:
                video_id = item["video_id"]["S"]
                if video_id not in video_map:
                    video = self._singer_video_item_to_video(item)
                    video_map[video_id] = video
                else:
                    # Add singer to existing video
                    singer_name = item.get("singer_name", {}).get("S", "")
                    if singer_name and singer_name not in video_map[video_id].singers:
                        video_map[video_id].singers.append(singer_name)

            videos = list(video_map.values())
            return videos[:limit]

        # Fallback to scanning videos table for other queries
        scan_kwargs = {"TableName": self._videos_table}

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
        # Use GSI_VIDEO_ID to get all singer records for this video
        response = self._client.query(
            TableName=self._singer_videos_table,
            IndexName="GSI_VIDEO_ID",
            KeyConditionExpression="video_id = :video_id",
            ExpressionAttributeValues={":video_id": {"S": video_id}},
        )

        items = response.get("Items", [])
        if not items:
            return None

        # Merge all singer records into one video
        video = self._singer_video_item_to_video(items[0])
        video.singers = []

        for item in items:
            singer_name = item.get("singer_name", {}).get("S", "")
            if singer_name and singer_name not in video.singers:
                video.singers.append(singer_name)

        return video

    def list_singers(self) -> List[SingerSummary]:
        # Use singer-videos table for efficient singer aggregation
        response = self._client.scan(TableName=self._singer_videos_table)
        items = response.get("Items", [])
        counts = {}
        latest_ids = {}

        for item in items:
            singer_name = item.get("singer_name", {}).get("S", "")
            video_id = item.get("video_id", {}).get("S", "")

            if singer_name:
                counts[singer_name] = counts.get(singer_name, 0) + 1
                # Update latest_id if not set or if this video is newer
                if singer_name not in latest_ids:
                    latest_ids[singer_name] = video_id

        summaries = [
            SingerSummary(
                name=name, video_count=count, latest_video_id=latest_ids.get(name)
            )
            for name, count in counts.items()
        ]
        summaries.sort(key=lambda s: s.name.lower())
        return summaries
