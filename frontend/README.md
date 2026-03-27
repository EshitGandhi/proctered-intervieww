# 🎨 Interview Platform Frontend

A modern, high-performance React application built with Vite, providing a seamless experience for candidates, interviewers, and administrators.

---

## 🏗️ Architecture & Project Structure

The frontend is built using **React 18** and **Vite**, organized into modular components and custom hooks to separate UI from business logic.

### `src/` Directory Overview

| Directory | Purpose |
| :--- | :--- |
| `assets/` | Static assets like logos, icons, and global images. |
| `components/` | Reusable UI patterns, organized by feature (Editor, Video, Proctoring). |
| `context/` | Global state management (Authentication). |
| `hooks/` | Custom side-effect logic (WebRTC, Recording, Code Execution). |
| `pages/` | Main application views and route-level components. |
| `services/` | API clients (Axios) and WebSocket (Socket.io) connectors. |
| `utils/` | Shared constants and helper functions. |

---

## 📄 File-by-File Documentation

### 🚀 Core
- **`main.jsx`**: The application entry point. Initializes React and renders the root.
- **`App.jsx`**: Defines the main routing structure using `react-router-dom`, including Protected Routes for different user roles.
- **`index.css` / `App.css`**: Global design system, including variables for colors, spacing, and typography.

### 🧠 Pages (`src/pages/`)
- **`AuthPage.jsx`**: Unified login and registration view for all users.
- **`CandidateDashboard.jsx`**: Main hub for candidates to view available jobs, track application status, and start pending rounds.
- **`MCQTest.jsx`**: Time-boxed assessment interface with auto-save and proctoring integration.
- **`CodeEvalRound.jsx`**: Technical challenge interface featuring a split-view IDE and real-time execution.
- **`AdminDashboard.jsx`**: Comprehensive control panel for managing jobs, MCQs, coding questions, and the candidate pipeline.
- **`InterviewerDashboard.jsx`**: Focused view for interviewers to schedule sessions and live-monitor ongoing interviews.
- **`InterviewerRoom.jsx` / `CandidateRoom.jsx`**: The real-time interview interfaces featuring video conferencing, shared code editor, and live chat.
- **`SessionPlayback.jsx`**: Review portal for recorded interviews, complete with AI-generated transcripts.

### 🛡️ Components (`src/components/`)
- **`CodeEditor/CodeEditorPanel.jsx`**: A wrapper around the Monaco Editor, supporting multi-language syntax highlighting and execution output.
- **`VideoModule/VideoPanel.jsx`**: Handles local/remote video rendering, mic/cam toggles, and connection status overlays.
- **`Proctoring/ProctoringComponents.jsx`**: UI widgets for displaying violation alerts and real-time candidate behavior logs.
- **`Layout/`**: Standardized `Sidebar`, `TopBar`, and `AppLayout` for consistent navigation.

### ⚙️ Hooks (`src/hooks/`)
- **`useWebRTC.js`**: Manages the life cycle of WebRTC peer connections, including ICE candidate exchange and track management.
- **`useProctoringMonitor.js`**: Passive browser monitoring for tab switching, window blurring, and blocked keyboard shortcuts.
- **`useCodeExecution.js`**: Interfaces with the backend Judge0 service to run and evaluate candidate code.
- **`useRecorder.js`**: Handles client-side media recording and progressive upload of interview segments.

### 🛠️ Services & Utils (`src/services/` & `src/utils/`)
- **`api.js`**: Axios instance configured with base URLs and automatic JWT attachment via interceptors.
- **`socket.js`**: Singleton Socket.io client for real-time signaling and synchronization.
- **`constants.js`**: Centralized configuration for supported programming languages, domains, and global thresholds.

---

## 🛠️ Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router 6
- **State Management**: React Context API
- **Real-time Communication**: Socket.io-client & WebRTC
- **Code Editor**: Monaco Editor (`@monaco-editor/react`)
- **Styling**: Vanilla CSS with CSS Variables
- **Icons**: Lucide React
