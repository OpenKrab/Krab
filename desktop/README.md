# 🦀 Krab Desktop Application

Desktop application for the Krab AGI Agent Framework built with Electron.

## Features

- 🖥️ **Cross-platform desktop app** (Windows, macOS, Linux)
- 💬 **Modern chat interface** with voice support
- 🎙️ **Voice integration** with real-time transcription
- 🛠️ **Integrated tools** for web browsing, system monitoring
- 🎨 **Beautiful UI** with responsive design
- 🔧 **Settings management** and customization
- 📊 **System monitoring** and process management

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Package application
npm run dist

# Run tests
npm test
```

### Project Structure

```
desktop/
├── main.ts              # Electron main process
├── preload.ts            # Preload script for security
├── index.html            # HTML template
├── package.json          # Dependencies and scripts
├── tsconfig.main.json   # TypeScript config for main process
├── vite.config.ts        # Vite config for renderer
└── dist/               # Build output
```

### Features

#### Chat Interface
- Real-time messaging with Krab AI
- Voice input support with visual indicators
- Message history and search
- Rich text formatting
- File attachment support

#### Voice Integration
- Real-time voice transcription
- Voice synthesis output
- Multiple language support
- Voice activity indicators

#### Tools Integration
- Web search and browsing
- System monitoring
- Process management
- File operations
- Settings configuration

#### System Integration
- Native menu bar integration
- System notifications
- Auto-start options
- Update management

## Building

### Development Build

```bash
# Development with hot reload
npm run dev
```

### Production Build

```bash
# Build for all platforms
npm run build:all

# Build specific platform
npm run build:main    # Main process
npm run build:renderer # Renderer process
```

### Packaging

```bash
# Create distributables
npm run dist

# Platform-specific builds
npm run pack          # Directory build
npm run dist           # Installer build
```

## Security

- Context isolation between main and renderer
- Preload script for secure IPC communication
- Content Security Policy (CSP) implementation
- Code signing for distribution

## Performance

- Optimized bundle sizes with Vite
- Lazy loading of components
- Efficient memory management
- Fast startup times

## Platform Support

- ✅ Windows 10+ (with WSL2 support)
- ✅ macOS 10.15+ (Intel and Apple Silicon)
- ✅ Linux (Ubuntu, Fedora, Arch, etc.)

## Distribution

### Windows
- NSIS installer with auto-update support
- Portable version available
- Code signing for Windows Store

### macOS
- DMG package with notarization
- Auto-update via Sparkle
- App Store distribution ready

### Linux
- AppImage for universal distribution
- .deb and .rpm packages
- Snap support

## Configuration

Settings are stored in:
- Windows: `%APPDATA%/krab-desktop`
- macOS: `~/Library/Application Support/krab-desktop`
- Linux: `~/.config/krab-desktop`

## Integration with Krab Core

The desktop app integrates with the core Krab framework through:
- IPC communication with CLI backend
- WebSocket connections to Gateway
- RESTful API calls to voice services
- File system integration for attachments

## Troubleshooting

### Common Issues

1. **App won't start**
   - Check Node.js version (18+)
   - Clear node_modules and reinstall
   - Check system permissions

2. **Voice not working**
   - Verify microphone permissions
   - Check audio device settings
   - Restart the application

3. **Build failures**
   - Clear build cache: `npm run clean`
   - Update dependencies: `npm update`
   - Check platform-specific requirements

### Debug Mode

```bash
# Enable debug logging
DEBUG=krab:* npm run dev

# Enable DevTools in production
krab-desktop --dev-tools
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## License

MIT License - see LICENSE file for details
