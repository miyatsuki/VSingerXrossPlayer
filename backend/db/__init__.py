from typing import List, Optional, Protocol

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
    # Import here to avoid circular dependency
    from db.dynamo import DynamoVideoRepository

    return DynamoVideoRepository.from_settings(settings)
