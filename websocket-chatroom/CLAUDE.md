# WebSocket Chatroom - CLAUDE.md

## Project Overview

A real-time multi-user chatroom built with **FastAPI** (backend) and **Next.js 14** (frontend), using WebSocket for bidirectional communication. Supports single-process and distributed (Redis Pub/Sub) deployment modes.

## Architecture

```
websocket-chatroom/
├── backend/          # Python FastAPI server
│   ├── api/          # Route handlers (user.py, chat.py)
│   ├── config/       # Settings via pydantic-settings + .env
│   ├── db/           # SQLAlchemy async engine + session (SQLite/aiosqlite)
│   ├── models/       # ORM models (User) + Pydantic models (ChatUser, MessageEvent)
│   ├── services/     # Business logic (UserService, RoomConnectionManager)
│   ├── utils/        # JWT + password hashing (security.py)
│   ├── app.py        # FastAPI app factory + lifespan + CORS
│   └── main.py       # Uvicorn entry point
├── frontend/         # Next.js 14 App Router
│   └── src/
│       ├── app/      # Pages: / (home), /login, /register, /chat
│       ├── lib/      # API client (api.ts)
│       ├── store/    # Zustand stores: auth (persisted), chat (in-memory)
│       └── types/    # TypeScript interfaces
```

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy (async), aiosqlite, python-jose (JWT), Redis (optional)
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Zustand
- **Auth**: JWT tokens (HS256), SHA256 password hashing
- **DB**: SQLite (async via aiosqlite)
- **Real-time**: Native FastAPI WebSocket + Redis Pub/Sub for multi-process

## Key Patterns

- **Layered backend**: `api/ → services/ → models/ → db/` — routes validate + delegate, logic lives in services
- **Connection management**: `RoomConnectionManager` tracks connections by phone number, broadcasts via local dict or Redis Pub/Sub
- **State management**: Auth store uses Zustand `persist` middleware (localStorage); Chat store is ephemeral
- **Message types**: `system_msg_user_login`, `system_msg_user_logout`, `user_send_msg`, `system_room_update_userlist`

## Development

```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py                    # http://localhost:8000, docs at /docs

# Frontend
cd frontend && npm install
npm run dev                       # http://localhost:3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/user/register` | Register (username, phone, password) |
| POST | `/api/v1/user/login` | Login → JWT token |
| GET | `/api/v1/user/check-phone/{phone}` | Check phone existence |
| GET | `/api/v1/user/check-username/{username}` | Check username existence |
| WS | `/api/v1/room/ws?token=xxx` | WebSocket chat connection |

## Configuration

Backend config via `backend/config/settings.py` + `.env`:
- `DATABASE_URL` — default `sqlite+aiosqlite:///./chat.db`
- `REDIS_URL` — default `redis://localhost:6379`
- `SECRET_KEY` — JWT signing key (change in production!)
- `ACCESS_TOKEN_EXPIRE_MINUTES` — default 1440 (24h)

Frontend env via `.env.local`:
- `NEXT_PUBLIC_API_URL` — default `http://localhost:8000`
- `NEXT_PUBLIC_WS_URL` — default `ws://localhost:8000`

## Notes

- Password hashing uses SHA256 (production should use bcrypt)
- WebSocket auth via query param `?token=xxx`
- Redis is optional — only needed for multi-process deployment
- No tests currently in the project
