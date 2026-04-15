# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tanjent is an AI voice-journaling assistant: the user speaks to a browser app, the backend runs the turn through Groq (Whisper STT → GPT-OSS-20B → Orpheus TTS), persists the conversation, and streams audio back.

## Repository layout

This is a single git repo containing two independently-run apps:

- `src/` — Vite + React + TypeScript frontend (port 5173)
- `backend/` — Python FastAPI backend (port 8000), with its own `.venv` and `.env`

Each has its own dependency/config files. The frontend does **not** call Groq directly — all Groq traffic is server-side in `backend/app/services/groq_service.py`. The frontend reads no env vars and has no `.env` file; only `backend/.env` exists.

## Commands

### Frontend (run from repo root)

```bash
npm install
npm run dev        # Vite dev server on :5173, proxies /auth and /sessions → :8000
npm run build      # tsc && vite build
npm run preview
```

There is no test runner or linter configured for the frontend.

### Backend (run from `backend/`)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Both the frontend and backend must be running for the app to work. The backend needs its own `backend/.env` (see `backend/.env.example`) with `DATABASE_URL`, `GROQ_API_KEY`, and `JWT_SECRET`. `DATABASE_URL` must use the async driver: `postgresql+asyncpg://…`.

Tables are auto-created on startup via `Base.metadata.create_all` in the lifespan handler (`backend/app/main.py`) — there are no migrations. Dropping and recreating the database is the current workaround for schema changes.

## Architecture

### Request flow for a journaling turn

`POST /sessions/{id}/turn` in `backend/app/routers/sessions.py` is the core endpoint. One HTTP request does the whole STT → LLM → TTS pipeline:

1. Verifies session ownership and that `status == active`.
2. Loads the full message history for the session (eager-loaded via `selectinload`) and prepends `SYSTEM_PROMPT`.
3. Calls Groq Whisper, then Groq chat, then Groq Orpheus TTS, in sequence.
4. Persists both the user and assistant `Message` rows in one commit.
5. Returns `{ transcript, response_text, audio_base64, session_id }` — the WAV audio is base64-inlined in the JSON response (not streamed).

`POST /sessions/{id}/complete` re-runs the LLM over the full transcript to generate a 2–3 sentence `summary` and flips `status` to `completed`. After completion, `turn` will 400.

### Groq service wrapper (`backend/app/services/groq_service.py`)

The Groq Python SDK is **synchronous**, so every call is wrapped with `asyncio.to_thread()` to avoid blocking the FastAPI event loop. If you add a new Groq call, follow the same pattern (`_foo_sync` + `async foo` wrapper) — don't call the SDK directly from a route.

Orpheus has a hard ~200 char input limit; `_truncate_for_tts()` trims to the last sentence boundary. Don't remove this — longer inputs will error out at Groq.

Models currently pinned: `whisper-large-v3`, `openai/gpt-oss-20b`, `canopylabs/orpheus-v1-english` (voice `hannah`).

### Auth

JWT bearer tokens (HS256) issued by `backend/app/routers/auth.py`, verified in `backend/app/deps.py::get_current_user`. The frontend stores the token in `localStorage` and `src/api/client.ts` attaches it to every axios request. Every `/sessions/*` route requires `get_current_user` and scopes queries by `user_id`.

### Data model

`User` 1→N `Session` 1→N `Message`. `Session.status` is an enum (`active` | `completed`). `Message.role` is an enum (`user` | `assistant`). All IDs are UUIDs. Defined in `backend/app/models/{user,session,message}.py`; all models must be imported in `backend/app/main.py`'s `from app.models import …` line so `Base.metadata.create_all` sees them.

### Frontend state machine

`src/hooks/useVoiceJournal.ts` is the heart of the frontend. It drives a status machine: `idle → recording → transcribing → thinking → speaking → idle`. It supports two input modes:

- **Manual**: `MediaRecorder` + push-to-talk button. Records `audio/webm;codecs=opus` (falls back to `mp4`) and ships the whole blob on stop.
- **Auto**: `@ricky0123/vad-web` (Silero VAD) in `src/hooks/useVAD.ts`. On `onSpeechEnd`, encodes a WAV and runs the pipeline; after the TTS reply finishes playing, VAD is restarted for the next utterance.

The hook uses **refs for all callbacks and the `autoMode`/`sessionId` values** (`autoModeRef`, `vadStartRef`, `onTurnCompleteRef`, etc.) — this is deliberate to avoid stale closures inside long-running VAD and audio-playback callbacks. Preserve this pattern when editing; don't "clean it up" by depending on the values directly in `useCallback`.

### Vite ONNX middleware

`vite.config.ts` ships a custom `serveOnnxFiles` plugin that serves Silero VAD's `.onnx` weights and the ONNX Runtime WASM/MJS files directly from `node_modules` at dev-server root paths (`/silero_vad_legacy.onnx`, `/ort-wasm-simd-threaded.wasm`, etc.). They can't live in `public/` because Vite's transform pipeline mangles the dynamic `import()` that ONNX Runtime uses for its WASM glue. If VAD stops loading in dev, check this middleware first.

`useVAD.ts` is configured with `baseAssetPath: '/'` and `onnxWASMBasePath: '/'` to match. Production builds are not currently wired up for these assets.

### API proxy

Vite dev server proxies `/auth` and `/sessions` to `http://localhost:8000` (`vite.config.ts`). `src/api/client.ts` uses an empty `baseURL` and relies on this proxy — don't hardcode `http://localhost:8000` in frontend code. CORS on the backend is locked to `http://localhost:5173`.
