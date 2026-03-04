# 🚂 Krab — Railway Deployment Guide

## Overview

Deploy Krab on Railway for easy cloud deployment with automatic scaling, persistent storage, and built-in monitoring.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository
- API keys for your LLM providers

## Quick Start

### Method 1: One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/yourusername/krab&plugins=postgresql)

### Method 2: Manual Setup

1. **Connect GitHub Repository:**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your Krab repository

2. **Configure Environment Variables:**
   ```bash
   # Required: LLM Provider
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key

   # Optional: Messaging Channels
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   DISCORD_BOT_TOKEN=your_discord_bot_token
   LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
   LINE_CHANNEL_SECRET=your_line_secret

   # Railway-specific
   NODE_ENV=production
   KRAB_RAILWAY=true
   KRAB_DEFAULT_MODEL=anthropic/claude-sonnet-4-5
   ```

3. **Deploy:**
   - Railway will automatically detect and build your app
   - Wait for deployment to complete (usually 2-5 minutes)

4. **Access Your App:**
   - Gateway: `https://your-project.railway.app` (port 18789)
   - Control Panel: `https://your-project.railway.app/control`
   - Health Check: `https://your-project.railway.app/health`

## Configuration

### Environment Variables

#### Required (Choose at least one)
```bash
# Google Gemini (Free tier available)
GEMINI_API_KEY=your_api_key_here

# OpenAI
OPENAI_API_KEY=your_api_key_here

# Anthropic Claude
ANTHROPIC_API_KEY=your_api_key_here

# DeepSeek (Budget-friendly)
DEEPSEEK_API_KEY=your_api_key_here
```

#### Optional: Messaging Channels
```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Discord Bot
DISCORD_BOT_TOKEN=your_discord_bot_token

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
LINE_CHANNEL_SECRET=your_line_secret

# WhatsApp (requires QR pairing)
# Note: WhatsApp works best on VPS, not serverless
```

#### Krab Configuration
```bash
# Model selection
KRAB_DEFAULT_MODEL=anthropic/claude-sonnet-4-5
KRAB_DEFAULT_MODEL_FALLBACK=openai/gpt-4o-mini

# Debug mode (set to 'false' for production)
KRAB_DEBUG=false

# Railway-specific flags
NODE_ENV=production
KRAB_RAILWAY=true
```

### Custom Domains

1. Go to your Railway project settings
2. Add custom domain
3. Railway will provide SSL certificate automatically

## Database Setup (Optional)

Railway supports PostgreSQL for production data:

1. **Add PostgreSQL Plugin:**
   - In Railway dashboard, click "Add Plugin"
   - Select "PostgreSQL"
   - Choose plan (Starter is free)

2. **Configure Database URL:**
   ```bash
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```

3. **Environment Variables:**
   Railway automatically provides these variables:
   - `Postgres.DATABASE_URL`
   - `Postgres.DATABASE_PRIVATE_URL`
   - `Postgres.USER`
   - `Postgres.PASSWORD`
   - `Postgres.DATABASE`
   - `Postgres.HOST`
   - `Postgres.PORT`

## Monitoring & Logs

### View Logs

```bash
# In Railway dashboard
1. Go to your project
2. Click on the "Deployments" tab
3. Click on the active deployment
4. View real-time logs
```

### Health Checks

Railway automatically monitors your app using the `/health` endpoint defined in `railway.json`.

### Metrics

- **CPU/Memory Usage:** Available in Railway dashboard
- **Request Count:** Built into Railway monitoring
- **Response Times:** Automatic performance tracking

## Scaling

### Horizontal Scaling

Railway supports horizontal scaling:

1. Go to project settings
2. Adjust "Instances" count
3. Railway will automatically load balance

### Vertical Scaling

Upgrade your plan for more resources:
- **Starter:** 512MB RAM, 1 CPU
- **Hobby:** 1GB RAM, 2 CPUs
- **Pro:** 4GB RAM, 4 CPUs (and more)

## Backup & Recovery

### Automatic Backups

Railway provides automatic backups for PostgreSQL databases.

### Manual Backup

```bash
# Connect to database
railway connect

# Create backup
pg_dump $DATABASE_URL > backup.sql
```

### Restore

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs in Railway dashboard
# Common issues:
- Missing environment variables
- Node.js version mismatch
- Dependencies not found
```

#### Runtime Errors
```bash
# Check application logs
# Common issues:
- Invalid API keys
- Database connection failures
- Port binding issues
```

#### Memory Issues
```bash
# Increase Railway plan
# Or optimize your code:
- Reduce concurrent operations
- Use streaming for large responses
- Implement caching
```

### Debug Mode

Enable debug logging:

```bash
# Set in Railway environment variables
KRAB_DEBUG=true
```

Restart deployment to apply changes.

## Cost Optimization

### Free Tier Usage

Railway offers generous free tier:
- 512MB RAM
- 1GB storage
- 100 hours/month
- PostgreSQL included

### Cost-Saving Tips

1. **Use Free LLM Providers:**
   ```bash
   KRAB_DEFAULT_MODEL=gemini/gemini-2.0-flash
   ```

2. **Optimize Resource Usage:**
   - Set appropriate timeouts
   - Use caching for repeated requests
   - Implement rate limiting

3. **Monitor Usage:**
   - Check Railway dashboard regularly
   - Set up alerts for cost thresholds

## Advanced Features

### Custom Build Commands

Edit `railway.json` for custom builds:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build:custom"
  }
}
```

### Environment-Specific Config

```json
{
  "environments": {
    "production": {
      "buildCommand": "npm run build:prod",
      "startCommand": "npm run start:prod"
    },
    "staging": {
      "buildCommand": "npm run build:staging",
      "startCommand": "npm run start:staging"
    }
  }
}
```

### Private Networking

For connecting to private services:

```bash
# Use Railway private networking
DATABASE_URL=${{Postgres.DATABASE_PRIVATE_URL}}
```

## Security Best Practices

### Environment Variables
- Never commit API keys to GitHub
- Use Railway's environment variable management
- Rotate keys regularly

### Network Security
- Railway provides automatic SSL/TLS
- Use private networking for databases
- Implement rate limiting in your app

### Access Control
- Configure channel access policies
- Use Railway's team features for collaboration
- Enable 2FA on your Railway account

## Update Deployment

### Automatic Updates

Railway automatically deploys when you push to your main branch.

### Manual Updates

```bash
# Trigger manual deployment
# In Railway dashboard:
1. Go to project
2. Click "Deploy" button
```

### Rollback

```bash
# Rollback to previous deployment
# In Railway dashboard:
1. Go to "Deployments" tab
2. Click on previous deployment
3. Click "Promote" or "Rollback"
```

## Support

### Railway Support
- [Railway Documentation](https://docs.railway.app/)
- [Railway Community](https://discord.gg/railway)

### Krab Support
- [GitHub Issues](https://github.com/yourusername/krab/issues)
- [Documentation](https://github.com/yourusername/krab/docs)

---

## 🚀 Quick Deploy Checklist

- [ ] Create Railway account
- [ ] Connect GitHub repository
- [ ] Add environment variables
- [ ] Deploy application
- [ ] Configure custom domain (optional)
- [ ] Set up database (optional)
- [ ] Test all features
- [ ] Monitor logs and metrics

Happy deploying! 🎉
