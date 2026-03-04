# 🦀 Krab Web Interface

Web-based chat interface for the Krab AGI Agent Framework with real-time communication and tool integration.

## Features

- 🌐 **Real-time Web Chat** with Socket.IO
- 🎙️ **Voice Integration** with browser-based voice input
- 🛠️ **Tool Panel** for quick access to Krab features
- 📱 **Responsive Design** that works on all devices
- 🔌 **Connection Management** with status indicators
- 🎨 **Modern UI** with smooth animations and gradients

## Architecture

### Backend Server (`web/server.ts`)
- **Express.js** HTTP server with Socket.IO
- **Real-time Communication** via WebSocket
- **CORS Support** for cross-origin requests
- **API Endpoints** for health checks and status
- **Tool Integration** with Krab core framework

### Frontend Client (`web/public/index.html`)
- **Single Page Application** with modern JavaScript
- **Socket.IO Client** for real-time communication
- **Voice Recording** using Web Audio API
- **Tool Cards** for interactive feature access
- **Responsive Layout** with mobile-first design

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Project Structure

```
web/
├── server.ts              # Express + Socket.IO server
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
└── public/
    └── index.html          # Frontend application
```

### Features

#### Chat Interface
- **Real-time Messaging** with instant delivery
- **Message History** with persistent storage
- **Typing Indicators** for better UX
- **Timestamp Display** for all messages
- **User Identification** with custom names

#### Voice Integration
- **Browser-based Recording** using Web Audio API
- **Visual Feedback** with recording indicators
- **Voice-to-Text** integration with Krab STT
- **Text-to-Speech** for voice responses

#### Tool Integration
- **Web Search** with real-time results
- **Voice Tools** for speech processing
- **System Monitor** for resource tracking
- **Browser Automation** for web interactions
- **Process Manager** for background tasks

#### System Features
- **Health Checks** via `/api/health`
- **Status Monitoring** via `/api/status`
- **Connection Management** with auto-reconnect
- **Error Handling** with user feedback

## API Endpoints

### GET `/api/health`
Returns server health status and version information.

### GET `/api/status`
Returns server status, uptime, and memory usage.

### Socket.IO Events

#### Client → Server
- `chat-message` - Send chat message
- `voice-data` - Send voice transcript
- `tool-request` - Execute tool

#### Server → Client
- `welcome` - Connection welcome message
- `chat-response` - Chat response from Krab
- `voice-response` - Voice processing result
- `tool-response` - Tool execution result
- `error` - Error notifications
- `chat-broadcast` - Broadcast messages to other clients

## Configuration

### Environment Variables
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)

### Development Settings
- **Hot Reload** with Vite dev server
- **TypeScript** compilation with watch mode
- **ESLint** for code quality
- **Concurrent** development of server and client

## Security

- **CORS Configuration** for cross-origin requests
- **Input Validation** on all endpoints
- **Rate Limiting** (placeholder for production)
- **Content Security** headers for frontend

## Performance

- **WebSocket Optimization** for real-time communication
- **Efficient Bundling** with Vite
- **Lazy Loading** of components
- **Memory Management** for connection handling

## Deployment

### Development
```bash
npm run dev
# Runs on http://localhost:3000
```

### Production
```bash
npm run build
npm start
# Runs on configured port
```

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- 📱 Mobile browsers with reduced feature set

## Integration with Krab Core

The web interface connects to the Krab framework through:
- **WebSocket Communication** with Socket.IO
- **HTTP API Calls** to core services
- **Tool Integration** via standardized protocol
- **Voice Pipeline** connection to STT/TTS services

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check if server is running: `npm start`
   - Verify port accessibility
   - Check firewall settings

2. **Voice Not Working**
   - Verify HTTPS context (required for microphone)
   - Check browser permissions
   - Use supported browser

3. **Build Errors**
   - Clear node_modules: `rm -rf node_modules`
   - Reinstall dependencies: `npm install`
   - Check TypeScript version

### Debug Mode
```bash
# Enable debug logging
DEBUG=krab:* npm run dev

# Verbose logging
VERBOSE=true npm start
```

## Future Enhancements

- [ ] User authentication and sessions
- [ ] File upload and attachment support
- [ ] Message search and filtering
- [ ] Theme customization
- [ ] Multi-language support
- [ ] Offline mode with service worker

## License

MIT License - see LICENSE file for details
