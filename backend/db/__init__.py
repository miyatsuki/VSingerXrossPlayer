from typing import List, Optional, Protocol

from .dynamo import DynamoVideoRepository

try:
    # When imported as backend.db
    from ..config import Settings
    from ..models import SingerSummary, Video
except ImportError:
    # When imported as top-level db
    from config import Settings
    from models import SingerSummary, Video


class VideoRepository(Protocol):
    def list_videos(
        self,
        q: Optional[str] = None,
        singer: Optional[str] = None,
        tag: Optional[str] = None,
        limit: int = 50,
    ) -> List[Video]: ...

    def get_video(self, video_id: str) -> Optional[Video]: ...

    def list_singers(self) -> List[SingerSummary]: ...


def create_video_repository(settings: Settings) -> VideoRepository:
    return DynamoVideoRepository.from_settings(settings)
