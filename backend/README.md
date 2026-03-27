# 🚀 Interview Platform Backend

Robust Node.js & Express server powering a proctored interview platform with real-time video/audio signaling, code execution, and AI-driven proctoring.

---

## 🏗️ Architecture & Project Structure

The project follows a modular architecture inspired by **MVC** (Model-View-Controller) and **Clean Architecture** patterns, leveraging MongoDB for persistence and Socket.io for real-time capabilities.

### `src/` Directory Overview

| Directory | Purpose |
| :--- | :--- |
| `config/` | Environment and external resource configuration (DB). |
| `controllers/` | Primary business logic and request/response handlers. |
| `middleware/` | Custom Express middleware for authentication, error handling, etc. |
| `models/` | Mongoose schemas representing the data structures. |
| `routes/` | API endpoint definitions linking URLs to controllers. |
| `services/` | External integrations (Judge0, Cloud Storage, AI transcription). |
| `socket/` | Real-time signaling and WebSocket event handlers. |

---

## 📄 File-by-File Documentation

### 🚀 Core
- **`server.js`**: The main entry point. Sets up Express, handles CORS/Security (Helmet), initializes Socket.io, connects to MongoDB, and registers all API routes.

### ⚙️ Configuration (`src/config/`)
- **`db.js`**: Manages MongoDB connection. Features a fallback to `mongodb-memory-server` if a local instance isn't detected, ensuring the app runs "zero-config."

### 🧠 Controllers (`src/controllers/`)
- **`application.controller.js`**: Manages candidate job applications, status updates, and interview scheduling workflows.
- **`codingQuestion.controller.js`**: CRUD operations for managing a bank of technical coding challenges.
- **`job.controller.js`**: Handles job posting management and role-based filtering (e.g., candidates see only active jobs).
- **`mcq.controller.js`**: Manages multiple-choice question sets for pre-screening assessments.

### 🛡️ Middleware (`src/middleware/`)
- **`auth.middleware.js`**: JWT-based authentication (`protect`) and role-based access control (`requireRole`).
- **`error.middleware.js`**: Centralized error interceptor to ensure consistent API error responses across the platform.

### 💾 Models (`src/models/`)
- **`User.js`**: Defines users (Candidate, Interviewer, Admin), handling password hashing and role assignments.
- **`Job.js`**: Schema for job postings including title, description, requirements, and domain.
- **`Application.js`**: Tracks the relationship between users and jobs, including interview status and scores.
- **`Interview.js`**: Stores scheduled interview sessions, room IDs, and durations.
- **`CodingQuestion.js` / `MCQ.js`**: Data models for assessment content.
- **`ProctoringLog.js`**: Records automated security violations (tab switching, face detection alerts).
- **`Recording.js`**: Metadata for stored interview video/audio sessions.
- **`CodeSubmission.js`**: Snapshots of candidate code submissions for review.

### 🌐 Routes (`src/routes/`)
- **`auth.routes.js`**: Basic registration, login, and profile management.
- **`job.routes.js`**: Endpoints for job discovery and management.
- **`application.routes.js`**: Routes for handling job applications and status changes.
- **`interview.routes.js`**: Orchestrates scheduling and interview session metadata.
- **`code.routes.js`**: Handles real-time code execution and shared editor synchronization.
- **`recording.routes.js`**: Manages media uploads, downloads, and cloud storage links.
- **`proctoring.routes.js`**: Endpoints to log and retrieve candidate behavior violations.
- **`mcq.routes.js` / `codingQuestion.routes.js`**: Access to assessment resources.

### 🛠️ Services (`src/services/`)
- **`judge0.service.js`**: Integration with Judge0 API for sandboxed code execution in Python, JS, Java, and C++.
- **`storage.service.js`**: Comprehensive utility for handling file uploads (Local/S3) for recordings, audio, and transcripts.
- **`transcription.service.js`**: AI-powered audio-to-text service using Groq + OpenAI Whisper for generating timestamped meeting transcripts.

### 📡 Real-time (`src/socket/`)
- **`signalingHandler.js`**: The heartbeat of the platform. Manages WebRTC peer signaling for video, live code sync for the shared editor, and real-time proctoring alerts between candidate and interviewer.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.io
- **Security**: Helmet, bcryptjs, JWT
- **AI/ML**: Groq Whisper (Transcription), Judge0 (Code Execution)
- **Storage**: Multer + AWS S3 / Local Storage fallback
