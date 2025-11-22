# Repository Guidelines

This repository contains the VSingerXrossPlayer front-end (Vite + React + TypeScript) and legacy backend utilities under `archive/`. Keep changes focused and incremental.

## Project Structure & Module Organization

- `src/`: SPA entry (`index.tsx`), root layout (`App.tsx`), global styles.
- `src/components/`: UI components (XMB navigation, AI visualizer, background video).
- `src/hooks/`: Shared logic such as `useData` and `useXMBNavigation`.
- `src/types/`: Domain types for singers, songs, categories, etc.
- `public/`: Static assets served as-is.
- `archive/`: Legacy Python services (admin, collector, inference); treat as read-mostly unless you are working on backend tooling.

## Build, Test, and Development Commands

- `npm install` — install Node.js dependencies.
- `npm run dev` (or `npm run start`) — run the Vite dev server (default `http://localhost:5173`).
- `npm run build` — create a production build under `dist/`.
- `npm run preview` — locally preview the built assets.
- Tests: React Testing Library + Jest types exist, but no test runner/npm script is wired yet; add one if you introduce tests.

## Coding Style & Naming Conventions

- Use TypeScript, React function components, and hooks for stateful logic.
- Follow existing formatting: 2-space indentation, semicolons, single quotes.
- Components and types are PascalCase (`XMBContainer`, `Singer`); variables and functions are camelCase.
- Prefer Emotion + MUI for styling (`@emotion/styled`, `@mui/material`); keep components small and focused.

## Testing Guidelines

- Place component tests alongside source files as `*.test.tsx` (see `src/App.test.tsx`).
- Use React Testing Library for behavior-focused tests (keyboard navigation, selection, data mapping).
- If you add tests, also configure a test runner (e.g., Vitest or Jest) and an `npm test` script; ensure all tests pass before merging.

## Commit & Pull Request Guidelines

- Follow conventional commit style where practical: `feat: ...`, `fix: ...`, `build(deps): ...`.
- Keep commits and PRs narrowly scoped; avoid mixing refactors with feature work.
- PRs should include a clear summary, screenshots or GIFs for UI changes, and reproduction/verification steps (`npm run dev`, `npm run build`).

## Security & Configuration Tips

- Never commit API keys or secrets. Use Vite env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_GOOGLE_API_KEY`) via `.env.local` or similar ignored files.
- Document any new environment variables in `README.md` and provide example values where possible.

## Agent-Specific Instructions

- Match the existing style and avoid reformatting unrelated files.
- Prefer small, behavior-preserving changes over large refactors.
- When editing `archive/`, do not modify runtime behavior unless explicitly required; keep infrastructure changes minimal and well-documented.

