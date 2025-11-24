from typing import List, Optional

from config import Settings, get_settings
from db import VideoRepository, create_video_repository
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from models import SingerSummary, Video


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="VSingerXrossPlayer Backend")

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",  # Vite dev server
            "http://localhost:5174",  # Vite dev server (alternative port)
            "http://localhost:5175",  # Vite dev server (alternative port)
            "http://localhost:3000",  # Alternative dev port
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    repo = create_video_repository(settings)

    def get_repo() -> VideoRepository:
        return repo

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/videos", response_model=List[Video])
    def list_videos(
        q: Optional[str] = Query(None),
        singer: Optional[str] = Query(None),
        tag: Optional[str] = Query(None),
        limit: int = Query(50, ge=1, le=200),
        repository: VideoRepository = Depends(get_repo),
    ) -> List[Video]:
        return repository.list_videos(q=q, singer=singer, tag=tag, limit=limit)

    @app.get("/videos/{video_id}", response_model=Video)
    def get_video(
        video_id: str,
        repository: VideoRepository = Depends(get_repo),
    ) -> Video:
        video = repository.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        return video

    @app.get("/singers", response_model=List[SingerSummary])
    def list_singers(
        repository: VideoRepository = Depends(get_repo),
    ) -> List[SingerSummary]:
        return repository.list_singers()

    return app


settings = get_settings()
app = create_app(settings)

try:
    from mangum import Mangum

    handler = Mangum(app)
except Exception:
    handler = None
