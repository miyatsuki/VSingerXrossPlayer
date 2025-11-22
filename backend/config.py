from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
  app_env: str = Field("local", alias="APP_ENV")
  aws_region: str = Field("ap-northeast-1", alias="AWS_REGION")
  dynamodb_table_videos: str = Field("videos", alias="VIDEOS_TABLE_NAME")
  dynamodb_endpoint_url: Optional[str] = Field(
    None,
    alias="DYNAMODB_ENDPOINT_URL",
  )
  repository_backend: Literal["dynamodb", "memory"] = Field(
    "memory",
    alias="REPOSITORY_BACKEND",
  )

  model_config = SettingsConfigDict(
    env_file=".env",
    extra="ignore",
  )


@lru_cache
def get_settings() -> Settings:
  return Settings()

