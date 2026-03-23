# 🎯 InterviewPro — Production-Ready Interview Platform

A modular, full-stack interview platform with WebRTC video, anti-cheating proctoring, Monaco code editor, and real-time signaling.

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + CSS design system |
| Video | WebRTC (browser P2P) + Socket.io signaling |
| Code Editor | Monaco Editor (VS Code in browser) |
| Code Execution | Judge0 API (C, C++, Java, Python, JavaScript) |
| Backend | Node.js + Express + Socket.io |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (RS256, role-based) |
| Storage | Local disk (swap for AWS S3) |

---

## 📁 Folder Structure

```
Interview Platform/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── middleware/auth.middleware.js, error.middleware.js
│   │   ├── models/ (User, Interview, ProctoringLog, CodeSubmission, Recording)
│   │   ├── routes/ (auth, interview, proctoring, code, recording)
│   │   ├── services/ (judge0.service.js, storage.service.js)
│   │   ├── socket/signalingHandler.js
│   │   └── server.js
│   └── .env.example
└── frontend/
    └── src/
        ├── components/
        │   ├── VideoModule/VideoPanel.jsx
        │   ├── CodeEditor/CodeEditorPanel.jsx
        │   ├── Proctoring/ProctoringComponents.jsx
        │   └── UI/InterviewTimer.jsx
        ├── context/AuthContext.jsx
        ├── hooks/ (useWebRTC, useProctoringMonitor, useCodeExecution, useRecorder)
        ├── pages/ (AuthPage, JoinPage, CandidateRoom, InterviewerDashboard, SessionPlayback)
        ├── services/ (api.js, socket.js)
        └── App.jsx
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **MongoDB** running locally (or use MongoDB Atlas)
- **Judge0 API key** from [RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce) (optional for code execution)

### 1. Backend

```powershell
cd "Interview Platform/backend"
copy .env.example .env            # then edit .env
npm install
npm run dev
```

### 2. Frontend

```powershell
cd "Interview Platform/frontend"
copy .env.example .env            # already configured for localhost
npm install
npm run dev
```

### 3. Open the app

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api/health

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `JUDGE0_API_KEY` | RapidAPI key for Judge0 |
| `FRONTEND_URL` | Frontend origin for CORS |
| `STORAGE_TYPE` | `local` or `s3` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_SOCKET_URL` | Backend socket URL |

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register candidate/interviewer |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Interviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/interviews` | Create interview (interviewer) |
| GET | `/api/interviews` | List all interviews |
| GET | `/api/interviews/:id` | Get interview by ID |
| GET | `/api/interviews/room/:roomId` | Get interview by room ID (candidate join) |
| PATCH | `/api/interviews/:id/start` | Start interview |
| PATCH | `/api/interviews/:id/end` | End interview |

### Code Execution
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/code/run` | Run code (Judge0, saves as run) |
| POST | `/api/code/submit` | Final submission |
| GET | `/api/code/interview/:id` | Get all submissions |

### Proctoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proctoring/log` | Log a violation event |
| GET | `/api/proctoring/interview/:id` | Get all logs |

### Recordings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/recordings/upload` | Upload video/audio blob |
| GET | `/api/recordings/interview/:id` | Get all recordings |

---

## ⚡ Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-room` | C→S | Join a room with role |
| `offer` / `answer` | C↔S↔C | WebRTC offer/answer exchange |
| `ice-candidate` | C↔S↔C | ICE candidate relay |
| `peer-joined` / `peer-left` | S→C | Peer presence notifications |
| `proctoring-violation` | C→S→C | Violation broadcast to interviewer |
| `chat-message` | C↔S↔C | In-room chat |

---

## 🛡 Anti-Cheating System

| Feature | Status |
|---------|--------|
| Tab switch detection | ✅ Monitored + logged |
| Window blur detection | ✅ Monitored + logged |
| Right-click blocking | ✅ Fully blocked |
| Copy/paste blocking (outside editor) | ✅ Blocked + logged |
| Keyboard shortcut blocking (DevTools, PrintScreen) | ✅ Blocked + logged |
| Fullscreen enforcement | ✅ Requested + exit logged |
| DevTools detection | ⚠ Heuristic (window size delta) |
| Screenshot blocking | ❌ Not possible in browsers |
| Multiple screen detection | ⚠ Via `window.screen.isExtended` |

> Browser security restrictions mean some features can only monitor/warn, not fully prevent.

---

## 🔌 Integrating into Another MERN Project

- **Backend**: Mount the Express router at any prefix, e.g. `app.use('/interview', interviewRouter)`. Share the existing MongoDB connection and JWT system.
- **Frontend**: Import individual React components/hooks from `src/components/` or `src/hooks/`. Each module (`VideoModule`, `CodeEditor`, `Proctoring`) is independently usable.
- All API calls go through `src/services/api.js` — just update `VITE_API_URL` to point to your host.
