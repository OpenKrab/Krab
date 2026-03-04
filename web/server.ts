// ============================================================
// 🦀 Krab — Web Interface Server
// ============================================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Socket.IO setup
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active connections
const connections = new Map<string, any>();

io.on('connection', (socket) => {
  console.log(`🌐 Web client connected: ${socket.id}`);
  
  // Store connection
  connections.set(socket.id, {
    connected: new Date(),
    lastActivity: new Date()
  });

  // Send welcome message
  socket.emit('welcome', {
    message: '🦀 Welcome to Krab Web Interface!',
    timestamp: new Date().toISOString(),
    clientId: socket.id
  });

  // Handle chat messages
  socket.on('chat-message', async (data) => {
    console.log(`💬 Message from ${socket.id}:`, data);
    
    try {
      // Process message through Krab core
      const response = await processMessage(data.message, {
        clientId: socket.id,
        timestamp: data.timestamp,
        metadata: data.metadata
      });

      // Send response back to sender
      socket.emit('chat-response', {
        id: data.id,
        response,
        timestamp: new Date().toISOString(),
        from: 'krab'
      });

      // Broadcast to other clients (optional)
      socket.broadcast.emit('chat-broadcast', {
        type: 'message',
        data: {
          id: data.id,
          user: data.user || 'Anonymous',
          message: data.message,
          timestamp: data.timestamp
        }
      });

    } catch (error) {
      console.error(`❌ Error processing message from ${socket.id}:`, error);
      
      socket.emit('error', {
        id: data.id,
        error: 'Failed to process message',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle voice data
  socket.on('voice-data', async (data) => {
    console.log(`🎙️ Voice data from ${socket.id}:`, data.type);
    
    try {
      if (data.type === 'transcript') {
        const response = await processVoiceTranscript(data.content, {
          clientId: socket.id,
          timestamp: data.timestamp
        });

        socket.emit('voice-response', {
          response,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`❌ Error processing voice data from ${socket.id}:`, error);
      
      socket.emit('error', {
        error: 'Failed to process voice data',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle tool requests
  socket.on('tool-request', async (data) => {
    console.log(`🛠️ Tool request from ${socket.id}:`, data.tool);
    
    try {
      const result = await executeTool(data.tool, data.params, {
        clientId: socket.id
      });

      socket.emit('tool-response', {
        id: data.id,
        tool: data.tool,
        result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`❌ Error executing tool ${data.tool}:`, error);
      
      socket.emit('error', {
        id: data.id,
        tool: data.tool,
        error: 'Tool execution failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`🌐 Web client disconnected: ${socket.id}, reason: ${reason}`);
    connections.delete(socket.id);
  });

  // Handle status updates
  socket.on('status-update', (data) => {
    const connection = connections.get(socket.id);
    if (connection) {
      connection.lastActivity = new Date();
    }
  });
});

// Message processing (placeholder - would connect to Krab core)
async function processMessage(message: string, context: any): Promise<string> {
  // Simulate AI response
  const responses = [
    "I understand your request. Let me help you with that.",
    "That's an interesting question! Here's what I think...",
    "I can help you with that. Let me process this for you.",
    "Great question! Based on my analysis...",
    "I see what you're looking for. Let me assist you with that."
  ];
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// Voice processing (placeholder)
async function processVoiceTranscript(transcript: string, context: any): Promise<string> {
  // Simulate voice processing
  console.log(`🎙️ Processing voice transcript: ${transcript}`);
  
  // This would connect to the actual voice processing pipeline
  return `I heard: "${transcript}". Let me help you with that.`;
}

// Tool execution (placeholder)
async function executeTool(tool: string, params: any, context: any): Promise<any> {
  console.log(`🛠️ Executing tool: ${tool} with params:`, params);
  
  switch (tool) {
    case 'web-search':
      return { 
        results: [
          { title: 'Search result 1', url: 'https://example.com/1' },
          { title: 'Search result 2', url: 'https://example.com/2' }
        ]
      };
    
    case 'system-monitor':
      return {
        cpu: '25%',
        memory: '60%',
        disk: '45%'
      };
    
    case 'voice-settings':
      return {
        enabled: true,
        language: 'en',
        engine: 'whisper'
      };
    
    default:
      return { error: `Unknown tool: ${tool}` };
  }
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`🌐 Krab Web Interface server running on port ${PORT}`);
  console.log(`📱 Access at: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('🔌 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('🔌 Server closed');
    process.exit(0);
  });
});
