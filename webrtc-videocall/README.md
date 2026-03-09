# WebRTC 1v1 Video Call

A production-grade 1v1 video call application built with WebRTC, featuring real-time whiteboard collaboration, AI-powered virtual backgrounds, live speech captions, and screen sharing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript 5.9 + Vite 7 |
| **UI** | Material-UI 7 + TailwindCSS 4 |
| **Signaling** | Node.js WebSocket server (ws) |
| **Media** | WebRTC (RTCPeerConnection, getUserMedia, getDisplayMedia) |
| **AI/ML** | MediaPipe Vision (selfie segmentation) |
| **Speech** | Web Speech API (SpeechRecognition) |
| **Testing** | Playwright (E2E) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser A                                │
│                                                                 │
│  App.tsx ─── useSignaling ──── WebSocket ────┐                  │
│    │                                         │                  │
│    ├── JoinRoom (landing)                    │                  │
│    │                                         │                  │
│    └── VideoCall (in-call)                   │    Signaling     │
│         ├── ControlBar                       │    Server        │
│         ├── Whiteboard ◄── DataChannel ──┐   │    (server.js)   │
│         ├── DebugLog                     │   │    port 8080     │
│         └── FilterPopup                  │   │                  │
│                                          │   │                  │
│  useWebRTC ─── RTCPeerConnection ────────┼───┤                  │
│  useScreenShare                          │   │                  │
│  useVirtualBackground (MediaPipe)        │   │                  │
│  useSpeechCaptions (Web Speech API)      │   │                  │
└──────────────────────────────────────────┼───┤                  │
                                           │   │                  │
┌──────────────────────────────────────────┼───┤                  │
│                        Browser B         │   │                  │
│                                          │   │                  │
│  (same architecture, mirrored)           │   │                  │
│  RTCPeerConnection ◄─── ICE/SDP ─────────┘   │                  │
│  DataChannel ◄──── whiteboard sync ──────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

### Signaling Flow

```
Caller                    Server                    Callee
  │                         │                         │
  │──── join(roomId) ──────►│                         │
  │◄─── joined(caller) ────│                         │
  │                         │                         │
  │                         │◄──── join(roomId) ──────│
  │                         │───── joined(callee) ───►│
  │◄─── peer-joined ───────│                         │
  │                         │                         │
  │──── offer(sdp) ────────►│───── offer(sdp) ───────►│
  │◄─── answer(sdp) ───────│◄──── answer(sdp) ──────│
  │◄───► candidate(ice) ──►│◄───► candidate(ice) ──►│
  │                         │                         │
  │◄════════ P2P Media + DataChannel ════════════════►│
```

## Features

### Core Video Call
- **Room-based joining** — enter a Room ID or generate a random one
- **1v1 peer-to-peer video/audio** — direct WebRTC connection via STUN
- **Audio processing** — echo cancellation, noise suppression, auto gain control
- **Mic/camera toggle** — mute audio or disable video independently
- **Local preview** — picture-in-picture self-view overlay during call
- **Connection status** — real-time state indicator (waiting → connecting → connected)

### Screen Sharing
- **One-click screen share** — uses `getDisplayMedia()` API
- **Track replacement** — swaps video track without renegotiation via `replaceTrack()`
- **Auto-restore** — restores camera when sharing ends (including browser-initiated stop)
- **Tab switcher** — toggle between Video and Screen views

### Collaborative Whiteboard
- **11 drawing tools** — pen, eraser, line, dashed line, arrow, double arrow, rectangle, circle, triangle, diamond, text
- **Color palette** — 8 preset colors + custom color picker
- **Fill mode** — solid fill for shapes with separate fill color picker
- **Adjustable sizes** — stroke width slider (1–20px), eraser (5–60px), font size (12–72px)
- **Undo / Clear** — undo last element or clear entire canvas
- **Real-time sync** — drawings, undo, and clear synced via WebRTC DataChannel
- **Mutual exclusivity** — whiteboard disabled during screen share and vice versa

### AI Virtual Background
- **MediaPipe selfie segmentation** — real-time person/background separation
- **Blur effect** — 12px gaussian blur on background
- **Image backgrounds** — 8 high-quality presets (Mountain, Beach, Forest, City Night, Aurora, Desert, Space, Café)
- **Canvas processing pipeline** — segment → composite → `captureStream(30fps)` → `replaceTrack()`
- **Applied to both local preview and remote peer** — processed stream is shared via PeerConnection

### Live Speech Captions
- **Web Speech API** — browser-native speech recognition
- **Multi-language** — configurable (default: zh-CN)
- **Interim + final results** — interim shown in italic at 70% opacity, final at full opacity
- **Auto-restart** — handles Chrome's automatic recognition stop with 50ms restart delay
- **Auto-clear** — finalized captions removed after 6 seconds

### Debug Panel
- **Real-time log viewer** — collapsible panel showing WebSocket, ICE, PeerConnection, and UI events
- **Color-coded sources** — cyan (ws), purple (pc), green (ice), amber (ui)
- **Direction indicators** — arrows for send (→) and receive (←) messages
- **Max 500 entries** — auto-scrolls to latest

## Project Structure

```
webrtc-videocall/
├── server.js                      # WebSocket signaling server (port 8080)
├── vite.config.ts                 # Vite + React + TailwindCSS + SSL + WS proxy
├── package.json
├── tsconfig.json
│
├── src/
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Root component & state orchestration
│   ├── types.ts                   # TypeScript type definitions
│   ├── index.css                  # Global styles, theme variables, fonts
│   │
│   ├── components/
│   │   ├── JoinRoom.tsx           # Landing page — room ID input, media preview
│   │   ├── VideoCall.tsx          # In-call UI — remote video, local PiP, overlays
│   │   ├── ControlBar.tsx         # Bottom toolbar — mic, camera, share, whiteboard, hangup
│   │   ├── Whiteboard.tsx         # Canvas drawing — 11 tools, real-time sync
│   │   ├── FilterPopup.tsx        # Virtual background selector modal
│   │   ├── DebugLog.tsx           # Collapsible log viewer panel
│   │   └── ErrorBoundary.tsx      # React error boundary for crash isolation
│   │
│   └── hooks/
│       ├── useSignaling.ts        # WebSocket client — connect, send, disconnect
│       ├── useWebRTC.ts           # RTCPeerConnection — offer/answer, ICE, DataChannel
│       ├── useScreenShare.ts      # getDisplayMedia — track replacement
│       ├── useVirtualBackground.ts # MediaPipe segmentation — blur/image backgrounds
│       └── useSpeechCaptions.ts   # Web Speech API — live speech-to-text
│
├── e2e/
│   ├── core-experiences.spec.ts   # 11 test groups — full E2E coverage
│   └── whiteboard-debug.spec.ts   # Whiteboard DOM/click debugging
│
└── playwright.config.ts           # Playwright config — Chromium, camera/mic permissions
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- **Chrome/Edge** (recommended for full WebRTC + Speech API support)

### Install

```bash
npm install
```

### Run (Development)

Open **two terminals**:

```bash
# Terminal 1 — signaling server
npm run server
# ✦ Signaling server running on ws://0.0.0.0:8080

# Terminal 2 — Vite dev server (HTTPS)
npm run dev
# https://localhost:5173/
```

Or run both at once:

```bash
npm start
```

> The dev server uses a **self-signed SSL certificate** (required for WebRTC `getUserMedia`). Accept the browser security warning to proceed.

### Test with Two Devices

1. Open `https://localhost:5173/` on Device A
2. Open `https://<your-local-ip>:5173/` on Device B (same WiFi)
3. Both enter the same Room ID → click **Join**
4. Echo cancellation is enabled by default for same-room testing

### Build for Production

```bash
npm run build
# Output in dist/
```

### Run E2E Tests

```bash
# Run all tests
npm run test:e2e

# Run with Playwright UI
npm run test:e2e:ui
```

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Callback refs** for video srcObject | Guarantees `srcObject` is set immediately on mount, unlike `useEffect` which runs after render |
| **Hidden `<audio>` element** for remote audio | Prevents audio loss when `<video>` unmounts (whiteboard/screen switch) |
| **`continuous: false`** for SpeechRecognition | Reduces caption latency by forcing shorter audio chunks to the recognition engine |
| **Ref-based `redrawCanvas`** | Stable function identity prevents ResizeObserver churn that clears canvas content |
| **`replaceTrack()`** for screen share & virtual bg | Avoids SDP renegotiation — seamless track swap on existing PeerConnection |
| **`pointer-events-none`** on header overlay | Allows clicks to pass through to whiteboard toolbar underneath |
| **`fixed` positioning** for local PiP | Escapes parent `overflow-hidden` stacking context to guarantee visibility |
| **MediaPipe GPU delegate** | Runs segmentation on GPU for real-time background replacement at 30fps |

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebRTC | ✅ | ✅ | ✅ | ✅ |
| Screen Share | ✅ | ✅ | ✅ | ✅ |
| Virtual Background | ✅ | ✅ | ⚠️ | ✅ |
| Speech Captions | ✅ | ❌ | ❌ | ✅ |
| DataChannel | ✅ | ✅ | ✅ | ✅ |

> Speech captions require Chrome or Edge (Web Speech API with server-side recognition).
> Virtual background may have reduced performance on Safari due to MediaPipe WASM support.

## License

MIT
