# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VSingerXrossPlayer is a web application for browsing "utatte mita" (cover song) videos using a PSP XMB-inspired interface. The project consists of:

- **Frontend** (`src/`): Vite + React + TypeScript SPA with XMB navigation
- **Backend** (`backend/`): FastAPI + DynamoDB (Lambda-ready with Mangum)
- **Collector** (`collector/`): YouTube data collection pipeline (independent package)
- **Archive** (`archive/`): Legacy Python services (read-only unless working on backend tooling)

## Development Commands

### Frontend (Root Directory)

```bash
npm install              # Install dependencies
npm run dev             # Start Vite dev server at http://localhost:5173
npm run start           # Alias for dev
npm run build           # Production build to dist/
npm run preview         # Preview production build
```

### Backend (backend/ Directory)

```bash
cd backend
uv sync                 # Install Python dependencies with uv
uv run uvicorn main:app --reload  # Start FastAPI dev server
uv run python -m pytest # Run tests (if configured)
```

### Collector (collector/ Directory)

```bash
cd collector
uv sync                 # Install Python dependencies with uv
uv run python -m collector.run_once --channel-id UC...  # Collect videos
uv run python scripts/create_tables.py  # Create DynamoDB table
```

Both backend and collector use `uv` for dependency management. Python 3.11+ is required.

## Architecture

### Frontend State Flow

The frontend uses a dual-axis navigation system that allows pivoting between song-centric and singer-centric views:

1. **Data Loading** (`src/hooks/useData.ts`): Fetches videos from backend API and transforms them into two category structures:

   - Song-centric: Each category is a song title containing covers by different singers
   - Singer-centric: Each category is a singer containing their covers of different songs

2. **Navigation** (`src/hooks/useXMBNavigation.ts`): Manages 2D cursor position (x=category, y=item) with arrow key controls

3. **Pivot Logic** (`src/App.tsx`): Tab key triggers axis transposition using `rotateToIndex()` to maintain the currently selected cover's position when switching between song/singer views

4. **Components**:
   - `XMBContainer`: Renders the horizontal category strip
   - `XMBCategory`: Renders vertical item lists with wave animation
   - `AIVisualizer`: Displays radar chart of AI-analyzed characteristics
   - `YouTubePlayer`: Full-screen modal player for selected cover (opens on Enter key)

### Backend Architecture

FastAPI application with pluggable repository pattern:

- **Models** (`backend/models.py`): Pydantic models for Video, SingerSummary, MasterData
- **Repository** (`backend/db/`): Abstract `VideoRepository` with implementations:
  - `DynamoVideoRepository` (dynamo.py): Production DynamoDB backend
  - `InMemoryVideoRepository` (memory.py): Local development with mock data
- **Config** (`backend/config.py`): Environment-based settings via pydantic-settings
- **Master Data** (`backend/masterdata.py`): Static singer metadata and song definitions
- **Lambda** (`backend/main.py`): Mangum handler exports `handler` for AWS Lambda deployment

Set `REPOSITORY_BACKEND=dynamodb` or `REPOSITORY_BACKEND=memory` to switch implementations.

### Data Collection (`collector/`)

The collector is an independent package that fetches YouTube video metadata:

- **Location**: `collector/` (top-level, separate from backend)
- **Dependencies**: Independent `pyproject.toml` and `uv.lock`
- **DynamoDB Table**: `vsxp-videos` (VSingerXrossPlayer dedicated)
- **Deployment**: Local CLI execution or AWS Lambda
- **Documentation**: See `collector/README.md` for detailed usage

Key modules:

- `youtube_client.py`: YouTube Data API v3 client
- `db.py`: DynamoDB video repository
- `run_once.py`: CLI entry point
- `handler.py`: Lambda handler for scheduled execution

## Type System

Key TypeScript types in `src/types/index.ts`:

- `AIStats`: Four-axis characteristics (energy, mood, vocal, instrumental)
- `Singer`: VSinger profile with ai_characteristics
- `Song`: Cover video with ai_stats and average_stats across all covers
- `Category`: Container for XMB horizontal navigation (type: singers|songs|settings|search)

Backend equivalent in `backend/models.py` with Pydantic models for FastAPI.

## Configuration & Environment

### Frontend

Environment variables use Vite's `VITE_*` prefix (e.g., `VITE_GOOGLE_API_KEY`). Define in `.env.local` (gitignored).

### Backend

Uses pydantic-settings for environment-based config:

- `REPOSITORY_BACKEND`: "memory" or "dynamodb" (default: "memory")
- `DYNAMODB_ENDPOINT_URL`: For local DynamoDB testing
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: AWS credentials
- `VIDEOS_TABLE_NAME`: DynamoDB table name (default: "vsxp-videos")

## Testing

Frontend has React Testing Library and Jest types configured but no test runner wired yet. If adding tests:

1. Configure Vitest or Jest with `npm install -D vitest`
2. Add `"test": "vitest"` to package.json scripts
3. Place tests as `*.test.tsx` alongside components

Backend can use pytest (already in dev dependencies).

## Key Patterns & Conventions

- **Styling**: Use Emotion CSS-in-JS with `@emotion/styled`. MUI components available via `@mui/material`
- **Naming**: PascalCase for components/types, camelCase for functions/variables
- **Formatting**: 2-space indentation, semicolons, single quotes (follow existing style)
- **State**: Use React hooks; avoid class components
- **Navigation**: XMB cursor is controlled externally via `useXMBNavigation` hook passed as prop
- **Backend**: Repository pattern allows swapping data sources without changing API endpoints

## Working with XMB Navigation

The XMB navigation system has complex rotation logic for pivoting between axes. When modifying:

- `rotateToIndex()` maintains cursor position during axis transpose
- Categories are cyclic (wrap around with modulo)
- Items within categories are also cyclic
- Tab key triggers pivot, arrow keys move cursor
- Mode indicator shows current axis (song-centric vs singer-centric)

## Notes from Existing Documentation

From `AGENTS.md`:

- Keep changes focused and incremental
- `archive/` contains legacy services; treat as read-mostly
- Never commit secrets; use `.env.local` for API keys
- Follow conventional commits: `feat:`, `fix:`, `build(deps):`
- PRs should include reproduction steps and screenshots for UI changes
- Avoid over-engineering; prefer small, behavior-preserving changes
- Don't add unnecessary error handling for impossible scenarios
