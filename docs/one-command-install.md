# 🦀 Krab — One-Command Installation Guide

## Overview

Get Krab up and running in minutes with our one-command installer! The `npx create-krab` command provides an interactive setup wizard that guides you through the entire installation process.

## Quick Start

### Install Krab Anywhere

```bash
# Install Krab with interactive setup
npx create-krab

# Or specify installation directory
npx create-krab my-krab-app

# Use latest version
npx create-krab@latest
```

### What the Installer Does

1. **Prerequisites Check**: Verifies Node.js 18+, npm, and Git
2. **Location Selection**: Choose where to install Krab
3. **Deployment Type**: Select your preferred deployment method
4. **Configuration**: Set up LLM providers and basic settings
5. **Installation**: Downloads, builds, and configures Krab
6. **Post-Setup**: Provides next steps and documentation links

## Deployment Options

### 1. Local Development (Recommended)
Perfect for first-time users and development:
- ✅ Interactive setup wizard
- ✅ Hot reload for development
- ✅ Local file system storage
- ✅ Easy debugging and testing

### 2. Docker Container
Production-ready containerized deployment:
- ✅ Multi-stage optimized Docker image
- ✅ Persistent data volumes
- ✅ Health checks and monitoring
- ✅ Easy scaling and backup

### 3. Railway (Cloud)
Serverless cloud deployment:
- ✅ Automatic HTTPS and scaling
- ✅ Built-in monitoring and logs
- ✅ PostgreSQL database included
- ✅ Zero cold starts

### 4. Render (Cloud)
Traditional cloud hosting:
- ✅ Free tier available
- ✅ Automatic SSL certificates
- ✅ Built-in CI/CD
- ✅ Docker support

### 5. VPS Manual Setup
Full control with custom VPS:
- ✅ Complete server control
- ✅ Custom performance tuning
- ✅ Advanced monitoring setup
- ✅ Cost-effective for high usage

## Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher (22+ recommended)
- **npm**: Latest version
- **Git**: For repository cloning
- **Internet**: For downloading dependencies

### Platform Support
- ✅ **macOS**: 10.15+
- ✅ **Linux**: Ubuntu 18.04+, CentOS 7+, Debian 9+
- ✅ **Windows**: 10+ with WSL2
- ✅ **Docker**: Any platform with Docker Desktop

## Installation Examples

### Example 1: Basic Local Setup

```bash
$ npx create-krab
🦀 Welcome to Krab Installer!
============================

Where would you like to install Krab? (./krab-app): my-first-krab

🚀 Choose deployment type:
1. Local Development (recommended for first-time users)
2. Docker Container
3. Railway (cloud)
4. Render (cloud)
5. VPS Manual Setup

Enter your choice (1-5): 1

🔑 Configure your Krab instance:
Choose your LLM provider:
1. Google Gemini (FREE)
2. OpenAI
3. Anthropic Claude
4. DeepSeek

Enter provider number (1-4): 1
Enter your GEMINI_API_KEY: your_api_key_here

✅ Environment configured
✅ Installation completed
✅ Local development setup complete

🎉 Installation complete!
=========================
Krab has been installed at: /path/to/my-first-krab

🚀 Quick start:
  cd my-first-krab
  npm run wizard    # Setup wizard
  npm run chat      # Start chat interface
  npm run dev       # Run in development mode
```

### Example 2: Docker Deployment

```bash
$ npx create-krab --docker
# Follow prompts...
# Select option 2 (Docker Container)

🎉 Docker setup complete!
=========================
To start Krab with Docker:
  cd my-krab-app
  docker-compose up -d
  docker-compose logs -f krab

Control Panel: http://localhost:3000/control
Gateway API: http://localhost:18789
```

### Example 3: Cloud Deployment

```bash
$ npx create-krab my-cloud-krab
# Select Railway or Render deployment

🎉 Railway setup complete!
==========================
To deploy to Railway:
1. Push this code to GitHub
2. Go to https://railway.app
3. Create new project from GitHub repo
4. Railway will auto-deploy!
```

## Configuration

### Automatic Configuration

The installer automatically creates:
- `.env` file with your API keys
- `package.json` with development scripts
- Docker files (if selected)
- Cloud deployment configs

### Post-Installation Configuration

After installation, you can further configure Krab:

```bash
cd your-krab-installation
npm run wizard  # Interactive configuration wizard
```

### Environment Variables

Common configuration options:

```env
# LLM Provider (required)
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# Optional: Messaging Channels
TELEGRAM_BOT_TOKEN=your_bot_token
DISCORD_BOT_TOKEN=your_bot_token

# Krab Settings
KRAB_DEFAULT_MODEL=anthropic/claude-sonnet-4-5
KRAB_DEBUG=true
NODE_ENV=development
```

## Troubleshooting

### Common Issues

#### "Node.js version too old"
```bash
# Upgrade Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### "Permission denied"
```bash
# Use sudo or fix npm permissions
npm config set prefix ~/.npm
export PATH="$HOME/.npm/bin:$PATH"
```

#### "Installation failed"
```bash
# Try with verbose logging
DEBUG=* npx create-krab

# Or install manually
git clone https://github.com/yourusername/krab.git
cd krab
npm install
npm run build
```

#### "Port already in use"
```bash
# Kill process using port
lsof -ti:18789 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Getting Help

- **Documentation**: https://github.com/yourusername/krab/docs
- **Issues**: https://github.com/yourusername/krab/issues
- **Discussions**: https://github.com/yourusername/krab/discussions

## Advanced Usage

### Custom Installation Directory

```bash
# Install in specific directory
npx create-krab /path/to/my/custom/location

# Install in current directory
npx create-krab .
```

### Non-Interactive Installation

```bash
# For CI/CD or automated deployments
echo "GEMINI_API_KEY=your_key" > .env
npx create-krab --yes --type local
```

### Development Installation

```bash
# Install with development dependencies
npx create-krab --dev

# Install specific version
npx create-krab@0.1.0
```

## Next Steps After Installation

### Start Using Krab

```bash
# Interactive chat
npm run chat

# Setup wizard (add more providers/channels)
npm run wizard

# Development mode
npm run dev

# Check status
curl http://localhost:3000/health
```

### Add More Features

```bash
# Add messaging channels
npm run wizard  # Select "Add Channel"

# Enable tools
npm run wizard  # Select "Configure Tools"

# Set up integrations
npm run wizard  # Select "Integrations"
```

### Production Deployment

```bash
# For Docker deployment
docker-compose up -d

# For cloud deployment
# Push to GitHub and deploy via Railway/Render

# For VPS deployment
# Follow docs/vps-deployment.md
```

## Uninstalling

```bash
# Remove Krab installation
rm -rf your-krab-directory

# Remove global npm packages (if installed)
npm uninstall -g krab
```

---

## 🎉 Happy Krabbing!

The one-command installer makes it easy to get started with Krab. Choose your preferred deployment method and start building AGI applications in minutes!

🦀 **Need help?** Check our [documentation](https://github.com/yourusername/krab/docs) or [create an issue](https://github.com/yourusername/krab/issues).
