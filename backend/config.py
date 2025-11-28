from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field("local", alias="APP_ENV")
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
def get_settings() -> Settings:
    return Settings()
