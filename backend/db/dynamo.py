from typing import List, Optional

import boto3
from boto3.dynamodb.conditions import Attr

try:
  # Imported as backend.db.dynamo
  from ..config import Settings
  from ..models import SingerSummary, Video
  from . import VideoRepository
except ImportError:
  # Imported as db.dynamo (top-level)
  from config import Settings  # type: ignore
  from models import SingerSummary, Video  # type: ignore
  from db import VideoRepository  # type: ignore


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
    filter_expression = None

    if q:
      text_filter = Attr("video_title").contains(q) | Attr("description").contains(q)
      filter_expression = text_filter if filter_expression is None else filter_expression & text_filter

    if singer:
      singer_filter = Attr("singers").contains(singer)
      filter_expression = singer_filter if filter_expression is None else filter_expression & singer_filter

    if tag:
      tag_filter = Attr("tags").contains(tag)
      filter_expression = tag_filter if filter_expression is None else filter_expression & tag_filter

    if filter_expression is not None:
      scan_kwargs["FilterExpression"] = filter_expression

    response = self._client.scan(**scan_kwargs)
    items = response.get("Items", [])
    videos = [self._item_to_video(item) for item in items]
    return videos[:limit]

  def get_video(self, video_id: str) -> Optional[Video]:
    scan_kwargs = {
      "TableName": self._table_name,
      "FilterExpression": Attr("video_id").eq(video_id),
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
      singers = self._parse_list(item.get("singers"))
      video_id = item.get("video_id", {}).get("S")
      for name in singers:
        counts[name] = counts.get(name, 0) + 1
        latest_ids.setdefault(name, video_id)
    summaries = [
      SingerSummary(name=name, video_count=count, latest_video_id=latest_ids.get(name))
      for name, count in counts.items()
    ]
    summaries.sort(key=lambda s: s.name.lower())
    return summaries

