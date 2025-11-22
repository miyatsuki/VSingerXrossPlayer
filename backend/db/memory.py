from typing import Dict, List, Optional

try:
  # Imported as backend.db.memory
  from ..config import Settings
  from ..models import SingerSummary, Video
  from . import VideoRepository
except ImportError:
  # Imported as db.memory (top-level)
  from config import Settings  # type: ignore
  from models import SingerSummary, Video  # type: ignore
  from db import VideoRepository  # type: ignore


SEED_VIDEOS: List[Video] = [
  Video(
    video_id="a51VH9BYzZA",
    video_title="Stellar Stellar / Hoshimachi Suisei (cover)",
    channel_id="channel_suisei",
    song_title="Stellar Stellar",
    singers=["Hoshimachi Suisei"],
    tags=["cover", "vsinger"],
  ),
  Video(
    video_id="Qp3b-RXtz4w",
    video_title="Usseewa / Ado (original)",
    channel_id="channel_ado",
    song_title="Usseewa",
    singers=["Ado"],
    tags=["original", "vsinger"],
  ),
  Video(
    video_id="mock_kaf_phony",
    video_title="Phony / Kaf (cover)",
    channel_id="channel_kaf",
    song_title="Phony",
    singers=["Kaf"],
    tags=["cover", "vsinger"],
  ),
]


class InMemoryVideoRepository(VideoRepository):
  def __init__(self, videos: List[Video]):
    self._videos = videos
    self._by_id: Dict[str, Video] = {v.video_id: v for v in videos}

  @classmethod
  def from_settings(cls, settings: Settings) -> "InMemoryVideoRepository":
    return cls(list(SEED_VIDEOS))

  def list_videos(
    self,
    q: Optional[str] = None,
    singer: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = 50,
  ) -> List[Video]:
    items = list(self._videos)

    if q:
      q_lower = q.lower()
      items = [
        v
        for v in items
        if q_lower in v.video_title.lower()
        or (v.song_title and q_lower in v.song_title.lower())
      ]

    if singer:
      singer_lower = singer.lower()
      items = [
        v
        for v in items
        if any(s.lower() == singer_lower for s in v.singers)
      ]

    if tag:
      tag_lower = tag.lower()
      items = [
        v
        for v in items
        if any(t.lower() == tag_lower for t in v.tags)
      ]

    return items[:limit]

  def get_video(self, video_id: str) -> Optional[Video]:
    return self._by_id.get(video_id)

  def list_singers(self) -> List[SingerSummary]:
    counts: Dict[str, int] = {}
    latest_ids: Dict[str, str] = {}
    for video in self._videos:
      for name in video.singers:
        counts[name] = counts.get(name, 0) + 1
        latest_ids.setdefault(name, video.video_id)
    summaries = [
      SingerSummary(name=name, video_count=count, latest_video_id=latest_ids.get(name))
      for name, count in counts.items()
    ]
    summaries.sort(key=lambda s: s.name.lower())
    return summaries

