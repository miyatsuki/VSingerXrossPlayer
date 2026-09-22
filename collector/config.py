from functools import lru_cache
from typing import List
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class CollectorSettings(BaseSettings):
    youtube_api_key: str = Field(..., alias="YOUTUBE_API_KEY")
    gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-3.8-flash", alias="GEMINI_MODEL")
    original_songs_path: str = Field(str(Path(__file__).resolve().parents[1] / "public" / "original-songs.json"), alias="ORIGINAL_SONGS_PATH")
    singer_channels_path: str = Field(
        str(Path(__file__).resolve().parents[1] / "public" / "singer-channels.json"),
        alias="SINGER_CHANNELS_PATH",
    )
    storage_backend: str = Field("json", alias="STORAGE_BACKEND")
    local_store_path: str = Field(
        str(Path(__file__).resolve().parents[1] / "data" / "collector-store.json"),
        alias="LOCAL_STORE_PATH",
    )
    public_data_dir: str = Field(
        str(Path(__file__).resolve().parents[1] / "public" / "data"),
        alias="PUBLIC_DATA_DIR",
    )
    target_channel_ids: List[str] = Field(
        default_factory=list,
        alias="TARGET_CHANNEL_IDS",
    )
    aws_region: str = Field("ap-northeast-1", alias="AWS_REGION")
    dynamodb_table_videos: str = Field("vsxp-videos", alias="VIDEOS_TABLE_NAME")
    dynamodb_table_singer_videos: str = Field(
        "vsxp-singer-videos", alias="SINGER_VIDEOS_TABLE_NAME"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_collector_settings() -> CollectorSettings:
    return CollectorSettings()
