require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/error.middleware');
const setupSignaling = require('./socket/signalingHandler');

// Routes
const authRoutes = require('./routes/auth.routes');
const interviewRoutes = require('./routes/interview.routes');
const proctoringRoutes = require('./routes/proctoring.routes');
const codeRoutes = require('./routes/code.routes');
const recordingRoutes = require('./routes/recording.routes');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e8, // 100MB for potential data transfers
});

setupSignaling(io);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/recordings', recordingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Interview Platform API is running', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    console.log(`📡 Socket.io ready`);
    console.log(`🌐 Frontend origin: ${FRONTEND_URL}`);
  });
};

start();
