from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class CollectorSettings(BaseSettings):
    youtube_api_key: str = Field(..., alias="YOUTUBE_API_KEY")
    gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
    target_channel_ids: List[str] = Field(
        default_factory=list,
        alias="TARGET_CHANNEL_IDS",
    )
    aws_region: str = Field("ap-northeast-1", alias="AWS_REGION")
    dynamodb_table_videos: str = Field("vsxp-videos", alias="VIDEOS_TABLE_NAME")
    dynamodb_table_singer_videos: str = Field(
        "vsxp-singer-videos", alias="SINGER_VIDEOS_TABLE_NAME"
    )
    dynamodb_endpoint_url: Optional[str] = Field(
        None,
        alias="DYNAMODB_ENDPOINT_URL",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_collector_settings() -> CollectorSettings:
    return CollectorSettings()
