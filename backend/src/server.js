import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRouter from './routes/chat.js';
import healthRouter from './routes/health.js';
import telemetryRouter from './routes/telemetry.js';
import analyticsRouter from './routes/analytics.js';
import { initKafka } from './services/kafkaService.js';
import { startThermalAutomationService } from './services/automationService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/health', healthRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/analytics', analyticsRouter);

// Service Root Info
app.get('/', (req, res) => {
  res.json({
    service: 'ORBIT Smart Home Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      chat: 'POST /api/chat',
      telemetry: '/api/telemetry/current',
      analytics: '/api/analytics/summary'
    },
    status: 'ONLINE'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 ORBIT Backend API Server is running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Telemetry: http://localhost:${PORT}/api/telemetry/current`);
  console.log(`======================================================\n`);

  // Connect Kafka in background
  initKafka().then(connected => {
    if (connected) {
      console.log('✅ Kafka Integration active.');
    } else {
      console.log('ℹ️  Kafka running in in-memory event mode.');
    }
  });

  // Start Autonomous Thermal Rules Service (>35°C Safe Mode, >30°C Light 1)
  startThermalAutomationService(4000);
});

// Handle server startup errors (e.g. port already in use)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [Server Error] Port ${PORT} is already in use!`);
    console.error(`👉 Either stop the process currently using port ${PORT}, or change PORT in backend/.env.\n`);
    process.exit(1);
  } else {
    console.error('❌ [Server Fatal Error]:', err);
    process.exit(1);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

export default app;
