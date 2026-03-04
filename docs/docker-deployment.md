# 🦀 Krab — Docker Deployment Guide

## Overview

Deploy Krab using Docker for easy containerized deployment with persistent data and optional services.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 1GB RAM minimum (2GB recommended)
- 2GB storage minimum

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/krab.git
   cd krab
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Build and run:**
   ```bash
   docker-compose up -d
   ```

4. **Check status:**
   ```bash
   docker-compose logs krab
   curl http://localhost:3000/health
   ```

5. **Access Control Panel:**
   Open http://localhost:3000/control

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required: Choose at least one LLM provider
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional: Messaging channels
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
DISCORD_BOT_TOKEN=your_discord_bot_token
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
LINE_CHANNEL_SECRET=your_line_secret

# Krab configuration
KRAB_DEFAULT_MODEL=anthropic/claude-sonnet-4-5
KRAB_DEBUG=false

# Optional: Database (if using PostgreSQL)
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://krab:password@postgres:5432/krab
```

### Volume Mounts

The Docker setup creates persistent volumes for:

- `./data:/app/data` - SQLite databases, session data
- `./config:/app/config` - Configuration files (optional)

## Docker Compose Services

### Core Service (krab)

Main Krab application with:
- Gateway server (port 18789)
- Webhook server (port 3000)
- Control panel UI
- Health checks

### Optional Services

#### PostgreSQL (profiles: postgres)
Production-ready database:
```bash
docker-compose --profile postgres up -d
```

#### Redis (profiles: redis)
Caching and session storage:
```bash
docker-compose --profile redis up -d
```

#### Nginx (profiles: proxy)
Reverse proxy with SSL:
```bash
docker-compose --profile proxy up -d
```

## Advanced Configuration

### Custom Dockerfile

For production optimization:

```dockerfile
FROM node:22-alpine AS builder
# ... build stage ...

FROM node:22-alpine AS production
# ... production stage ...

# Add custom optimizations
RUN apk add --no-cache sqlite
ENV NODE_ENV=production
```

### Multi-stage Deployment

For zero-downtime deployments:

```bash
# Build new image
docker-compose build --no-cache

# Deploy with blue-green
docker-compose up -d --scale krab=2
docker-compose up -d --scale krab=1
```

### Resource Limits

Adjust resources in `docker-compose.yml`:

```yaml
services:
  krab:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## Monitoring & Logs

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs krab

# Follow logs
docker-compose logs -f krab
```

### Health Checks

```bash
# Check container health
docker-compose ps

# Manual health check
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

### Resource Usage

```bash
# Container stats
docker stats

# Specific container
docker stats krab_krab_1
```

## Backup & Recovery

### Backup Data

```bash
# Stop containers
docker-compose down

# Backup data directory
tar -czf backup-$(date +%Y%m%d).tar.gz ./data/

# Start containers
docker-compose up -d
```

### Restore Data

```bash
# Stop containers
docker-compose down

# Restore data
tar -xzf backup-20240101.tar.gz

# Start containers
docker-compose up -d
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using ports
netstat -tulpn | grep :18789
netstat -tulpn | grep :3000

# Change ports in docker-compose.yml
ports:
  - "18889:18789"
  - "3001:3000"
```

#### Permission Issues
```bash
# Fix data directory permissions
sudo chown -R 1001:1001 ./data/
```

#### Memory Issues
```bash
# Increase Docker memory limit
# Docker Desktop: Preferences > Resources > Memory
```

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
echo "KRAB_DEBUG=true" >> .env

# Restart containers
docker-compose restart krab
```

## Production Deployment

### With SSL (Let's Encrypt)

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-ssl.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - krab
```

### Load Balancing

For high availability:

```yaml
services:
  krab:
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
```

## Security Considerations

### Environment Variables
- Store sensitive data in `.env` (gitignored)
- Use Docker secrets for production
- Rotate API keys regularly

### Network Security
- Use internal networks for database
- Restrict exposed ports
- Enable firewall rules

### Container Security
- Run as non-root user (UID 1001)
- Use minimal base images
- Regular security updates

## Update Procedure

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check logs
docker-compose logs -f krab
```

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: destroys data)
docker-compose down -v

# Clean up images
docker system prune -a
```
