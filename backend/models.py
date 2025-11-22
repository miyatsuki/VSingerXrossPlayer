from typing import List, Optional

from pydantic import BaseModel


class Video(BaseModel):
  video_id: str
  video_title: str
  channel_id: Optional[str] = None
  description: Optional[str] = None
  duration: Optional[int] = None
  published_at: Optional[str] = None
  song_title: Optional[str] = None
  singers: List[str] = []
  tags: List[str] = []
  is_cover: Optional[bool] = None
  link: Optional[str] = None
  game_title: Optional[str] = None
  genre: Optional[str] = None


class VideoQuery(BaseModel):
  q: Optional[str] = None
  singer: Optional[str] = None
  tag: Optional[str] = None
  limit: int = 50


class SingerSummary(BaseModel):
  name: str
  video_count: int
  latest_video_id: Optional[str] = None


