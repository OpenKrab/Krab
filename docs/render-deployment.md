# 🎨 Krab — Render Deployment Guide

## Overview

Deploy Krab on Render for reliable cloud hosting with automatic HTTPS, monitoring, and scaling.

## Prerequisites

- Render account (https://render.com)
- GitHub repository
- API keys for your LLM providers

## Quick Start

### One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/krab)

### Manual Setup

1. **Connect GitHub Repository:**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the Krab repository

2. **Configure Service:**
   ```yaml
   Name: krab
   Runtime: Node
   Build Command: npm run build
   Start Command: npm run start:prod
   Plan: Starter ($7/month)
   ```

3. **Environment Variables:**
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

   # Render-specific
   NODE_ENV=production
   KRAB_RENDER=true
   KRAB_DEFAULT_MODEL=anthropic/claude-sonnet-4-5
   ```

4. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment to complete (usually 5-10 minutes)

5. **Access Your App:**
   - Gateway: `https://krab.onrender.com` (port 10000)
   - Control Panel: `https://krab.onrender.com/control`
   - Health Check: `https://krab.onrender.com/health`

## Configuration

### Environment Variables

#### Required (Choose at least one)
```bash
# Google Gemini (Free tier available)
GEMINI_API_KEY=your_api_key_here

# OpenAI
OPENAI_API_KEY=your_api_key_here

# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key

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

# Render-specific flags
NODE_ENV=production
KRAB_RENDER=true
```

### Custom Domains

1. Go to your Render service settings
2. Click "Settings" tab
3. Scroll to "Custom Domains"
4. Add your domain and follow DNS instructions
5. Render provides free SSL certificate

## Database Setup (Optional)

Render supports PostgreSQL databases:

1. **Create Database:**
   - In Render dashboard, click "New" → "PostgreSQL"
   - Choose plan (Starter is $7/month)
   - Name it `krab-db`

2. **Connect to Application:**
   ```bash
   DATABASE_URL=your_render_postgres_url
   ```

3. **Environment Variables:**
   Render automatically provides these for PostgreSQL:
   - `DATABASE_URL` (External connection string)
   - `DATABASE_PRIVATE_URL` (Internal connection)

## Monitoring & Logs

### View Logs

```bash
# In Render dashboard
1. Go to your service
2. Click "Logs" tab
3. View real-time logs
4. Filter by time, level, or search terms
```

### Health Checks

Render automatically monitors your app using the `/health` endpoint.

### Metrics

- **CPU/Memory Usage:** Available in service dashboard
- **Request Count & Response Times:** Built-in monitoring
- **Uptime:** 99.9% SLA on paid plans

## Scaling

### Vertical Scaling

Upgrade your plan for more resources:
- **Starter:** 512MB RAM, 0.5 CPU
- **Standard:** 2GB RAM, 1 CPU
- **Pro:** 4GB RAM, 2 CPUs (and more)

### Horizontal Scaling

Render supports horizontal scaling with multiple instances:

1. Go to service settings
2. Adjust "Instances" count
3. Render automatically load balances

## Backup & Recovery

### Automatic Backups

Render provides automatic daily backups for PostgreSQL databases.

### Manual Backup

```bash
# Connect to database
psql $DATABASE_URL

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
# Check build logs in Render dashboard
# Common issues:
- Missing environment variables
- Node.js version mismatch
- Build timeout (increase timeout in settings)
```

#### Runtime Errors
```bash
# Check application logs
# Common issues:
- Database connection failures
- Invalid API keys
- Port binding issues (Render uses $PORT)
```

#### Memory Issues
```bash
# Upgrade Render plan
# Or optimize your code:
- Reduce concurrent operations
- Use streaming responses
- Implement proper error handling
```

### Debug Mode

Enable debug logging:

```bash
# Set in Render environment variables
KRAB_DEBUG=true
```

Redeploy to apply changes.

## Cost Optimization

### Free Tier Usage

Render offers a generous free tier:
- 750 hours/month
- 1GB bandwidth/month
- Static sites free forever

### Cost-Saving Tips

1. **Use Free LLM Providers:**
   ```bash
   KRAB_DEFAULT_MODEL=gemini/gemini-2.0-flash
   ```

2. **Optimize Resource Usage:**
   - Set appropriate timeouts
   - Use caching for repeated requests
   - Implement connection pooling

3. **Monitor Usage:**
   - Check Render dashboard regularly
   - Set up billing alerts

## Advanced Features

### Blue-Green Deployments

Render supports blue-green deployments:

```yaml
# In render.yaml
services:
  - type: web
    name: krab
    runtime: node
    blueGreen: true
```

### Private Services

For internal services:

```yaml
services:
  - type: pserv  # Private service
    name: krab-worker
    runtime: node
    plan: starter
```

### Cron Jobs

For scheduled tasks:

```yaml
services:
  - type: cron
    name: krab-cleanup
    runtime: node
    schedule: "0 2 * * *"  # Daily at 2 AM
    command: npm run cleanup
```

## Security Best Practices

### Environment Variables
- Never commit API keys to GitHub
- Use Render's environment variable management
- Rotate keys regularly

### Network Security
- Render provides automatic HTTPS
- Use private services for databases
- Implement rate limiting in your app

### Access Control
- Configure channel access policies
- Use Render's team features for collaboration
- Enable 2FA on your account

## Update Deployment

### Automatic Updates

Render automatically deploys when you push to your connected branch.

### Manual Updates

```bash
# Trigger manual deployment
# In Render dashboard:
1. Go to your service
2. Click "Manual Deploy" → "Deploy latest commit"
```

### Rollback

```bash
# Rollback to previous deployment
# In Render dashboard:
1. Go to "Deploys" tab
2. Find previous successful deploy
3. Click "Promote"
```

## Environment-Specific Config

### Production vs Staging

Create separate services for different environments:

```yaml
# Production
services:
  - type: web
    name: krab-prod
    branch: main

# Staging
services:
  - type: web
    name: krab-staging
    branch: develop
```

## Integration with Other Tools

### Webhooks

Render can send deployment webhooks to Slack, Discord, etc.

### API

Use Render API for programmatic deployments:

```bash
curl -X POST \
  https://api.render.com/v1/services/$SERVICE_ID/deploys \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```

## Support

### Render Support
- [Render Documentation](https://docs.render.com/)
- [Render Community](https://community.render.com/)

### Krab Support
- [GitHub Issues](https://github.com/yourusername/krab/issues)
- [Documentation](https://github.com/yourusername/krab/docs)

---

## 🚀 Quick Deploy Checklist

- [ ] Create Render account
- [ ] Connect GitHub repository
- [ ] Configure environment variables
- [ ] Create web service
- [ ] Set up database (optional)
- [ ] Configure custom domain (optional)
- [ ] Test all features
- [ ] Set up monitoring

Happy deploying! 🎉
