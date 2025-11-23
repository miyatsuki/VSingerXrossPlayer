from typing import Dict, List, Optional

from pydantic import BaseModel


class AIStats(BaseModel):
    energy: int
    mood: int
    vocal: int
    instrumental: int


class Singer(BaseModel):
    id: str
    name: str
    avatar_url: str
    description: Optional[str] = None
    ai_characteristics: Optional[AIStats] = None


class Song(BaseModel):
    id: str
    title: str
    video_url: str
    singer_id: str
    thumbnail_url: Optional[str] = None
    ai_tags: Optional[List[str]] = None
    ai_stats: Optional[AIStats] = None
    average_stats: Optional[AIStats] = None
    published_at: Optional[str] = None


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
    original_song_title: Optional[str] = None
    original_artist_name: Optional[str] = None
    ai_stats: Optional[AIStats] = None
    average_stats: Optional[AIStats] = None


class VideoQuery(BaseModel):
    q: Optional[str] = None
    singer: Optional[str] = None
    tag: Optional[str] = None
    limit: int = 50


class SingerSummary(BaseModel):
    name: str
    video_count: int
    latest_video_id: Optional[str] = None


class MasterData(BaseModel):
    singers: List[Singer]
    reference_songs: List[Song]
    song_averages: Dict[str, AIStats]
