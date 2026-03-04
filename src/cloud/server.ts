// ============================================================
// 🦀 Krab — Cloud Deployment Server
// ============================================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from '../utils/logger.js';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'https://krab.ai'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: NODE_ENV
  });
});

// API routes
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: NODE_ENV
  });
});

app.get('/api/v1/status', (req, res) => {
  res.json({
    status: 'operational',
    uptime: process.uptime(),
    totalUsers: 0, // TODO: Implement user tracking
    activeSessions: 0, // TODO: Implement session tracking
    systemLoad: process.cpuUsage(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Authentication middleware (placeholder)
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey && NODE_ENV === 'production') {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide a valid API key in the X-API-Key header'
    });
  }

  // TODO: Implement proper API key validation
  next();
};

// Protected routes
app.get('/api/v1/users/profile', authenticate, (req, res) => {
  res.json({
    userId: 'user-123',
    email: 'user@example.com',
    plan: 'free',
    createdAt: new Date().toISOString()
  });
});

// Chat API endpoints
app.post('/api/v1/chat/message', authenticate, async (req, res) => {
  try {
    const { message, sessionId, context } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
        message: 'Please provide a message in the request body'
      });
    }

    // TODO: Process message through Krab core
    const response = await processMessage(message, { sessionId, context });

    res.json({
      messageId: `msg-${Date.now()}`,
      response,
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'default'
    });

  } catch (error) {
    logger.error('Chat API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process chat message'
    });
  }
});

// Tool execution API
app.post('/api/v1/tools/execute', authenticate, async (req, res) => {
  try {
    const { tool, parameters, sessionId } = req.body;

    if (!tool || !parameters) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Tool name and parameters are required'
      });
    }

    // TODO: Execute tool through Krab registry
    const result = await executeTool(tool, parameters, { sessionId });

    res.json({
      executionId: `exec-${Date.now()}`,
      tool,
      result,
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'default'
    });

  } catch (error) {
    logger.error('Tool execution API error:', error);
    res.status(500).json({
      error: 'Tool execution failed',
      message: 'Failed to execute the requested tool'
    });
  }
});

// WebSocket setup
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'https://krab.ai'],
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// WebSocket authentication
io.use((socket, next) => {
  const apiKey = socket.handshake.auth.apiKey || socket.handshake.query.apiKey;

  if (!apiKey && NODE_ENV === 'production') {
    return next(new Error('Authentication error'));
  }

  // TODO: Implement proper authentication
  next();
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`🌐 WebSocket client connected: ${socket.id}`);

  // Send welcome message
  socket.emit('welcome', {
    message: '🦀 Welcome to Krab Cloud API!',
    timestamp: new Date().toISOString(),
    clientId: socket.id,
    version: process.env.npm_package_version || '1.0.0'
  });

  // Handle chat messages
  socket.on('chat-message', async (data) => {
    try {
      logger.info(`💬 WebSocket message from ${socket.id}:`, data);

      const response = await processMessage(data.message, {
        sessionId: data.sessionId,
        clientId: socket.id,
        context: data.context
      });

      socket.emit('chat-response', {
        messageId: `msg-${Date.now()}`,
        response,
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId || 'default'
      });

    } catch (error) {
      logger.error(`WebSocket chat error from ${socket.id}:`, error);
      socket.emit('error', {
        type: 'chat_error',
        message: 'Failed to process chat message',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle tool execution
  socket.on('tool-execute', async (data) => {
    try {
      logger.info(`🛠️ WebSocket tool execution from ${socket.id}:`, data);

      const result = await executeTool(data.tool, data.parameters, {
        sessionId: data.sessionId,
        clientId: socket.id
      });

      socket.emit('tool-result', {
        executionId: `exec-${Date.now()}`,
        tool: data.tool,
        result,
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId || 'default'
      });

    } catch (error) {
      logger.error(`WebSocket tool error from ${socket.id}:`, error);
      socket.emit('error', {
        type: 'tool_error',
        message: 'Failed to execute tool',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle heartbeat
  socket.on('heartbeat', (data) => {
    socket.emit('heartbeat-response', {
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info(`🌐 WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// Placeholder functions (will be replaced with actual implementations)
async function processMessage(message: string, context: any): Promise<string> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

  // TODO: Integrate with Krab core agent
  const responses = [
    "I understand your request. Let me help you with that.",
    "That's an interesting question! Here's what I think...",
    "I can help you with that. Let me process this for you.",
    "Great question! Based on my analysis...",
    "I see what you're looking for. Let me assist you with that."
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

async function executeTool(tool: string, parameters: any, context: any): Promise<any> {
  // TODO: Integrate with Krab tool registry
  logger.info(`Executing tool: ${tool} with parameters:`, parameters);

  // Simulate tool execution
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

  return {
    success: true,
    output: `Tool ${tool} executed successfully`,
    parameters,
    timestamp: new Date().toISOString()
  };
}

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Express error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on our end'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`☁️ Krab Cloud API server running on port ${PORT}`);
  logger.info(`🌐 Environment: ${NODE_ENV}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`📚 API docs: http://localhost:${PORT}/api/v1`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('🔌 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('🔌 Server closed');
    process.exit(0);
  });
});

export { app, httpServer, io };
