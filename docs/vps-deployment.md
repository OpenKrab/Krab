# 🖥️ Krab — VPS Deployment Guide

## Overview

Deploy Krab on a Virtual Private Server (VPS) for full control, persistent connections, and optimal performance for messaging applications.

## Recommended VPS Providers

### Budget-Friendly Options

#### DigitalOcean ($6/month)
- **Droplet:** Basic, 1GB RAM, 1 CPU
- **Pros:** Simple interface, good documentation
- **Best for:** Getting started, development

#### Linode ($5/month)
- **Nanode:** 1GB RAM, 1 CPU, 25GB storage
- **Pros:** Excellent performance, good network
- **Best for:** Production workloads

#### Vultr ($2.50/month)
- **Cloud Compute:** 512MB RAM, 1 CPU
- **Pros:** Very affordable, global locations
- **Best for:** Cost-conscious deployments

### Performance-Oriented Options

#### Hetzner (€3.79/month)
- **CX11:** 2GB RAM, 1 CPU, 20TB traffic
- **Pros:** Excellent value, German quality
- **Best for:** European users

#### OVHcloud (€3.59/month)
- **VPS Starter:** 2GB RAM, 1 CPU
- **Pros:** French hosting, good uptime
- **Best for:** European users

#### Contabo (€2.99/month)
- **VPS S:** 8GB RAM, 4 CPUs
- **Pros:** High specs for low price
- **Best for:** Resource-intensive apps

## Quick Setup (Ubuntu 22.04)

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git htop ufw fail2ban

# Set up firewall
sudo ufw allow ssh
sudo ufw allow 18789  # Gateway port
sudo ufw allow 3000   # Webhook server port
sudo ufw --force enable

# Create krab user
sudo adduser krab
sudo usermod -aG sudo krab
su - krab
```

### 2. Install Node.js

```bash
# Install Node.js 22 using NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v22.x.x
npm --version   # Should show latest
```

### 3. Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'krab',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 18789
    },
    env_production: {
      NODE_ENV: 'production',
      KRAB_VPS: true
    }
  }]
};
EOF
```

### 4. Deploy Krab

```bash
# Clone repository
git clone https://github.com/yourusername/krab.git
cd krab

# Install dependencies
npm install

# Build application
npm run build

# Create environment file
cat > .env << EOF
# Required: Choose your LLM provider
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional: Messaging channels
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
DISCORD_BOT_TOKEN=your_discord_bot_token
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
LINE_CHANNEL_SECRET=your_line_secret

# VPS-specific configuration
NODE_ENV=production
KRAB_VPS=true
KRAB_DEFAULT_MODEL=anthropic/claude-sonnet-4-5
KRAB_DEBUG=false

# Database (optional, defaults to SQLite)
# DATABASE_URL=postgresql://user:password@localhost:5432/krab
EOF

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u krab --hp /home/krab
```

### 5. Set up Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo cat > /etc/nginx/sites-available/krab << EOF
server {
    listen 80;
    server_name your-domain.com;

    # Gateway API
    location / {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Webhook server
    location /webhooks/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static files (if any)
    location /static/ {
        alias /home/krab/krab/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/krab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Set up SSL (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Set up auto-renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 7. Set up Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop iotop ncdu

# PM2 monitoring
pm2 monit

# System monitoring with PM2
pm2 install pm2-server-monit
```

## Advanced Configuration

### PostgreSQL Database Setup

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE krab;
CREATE USER krab_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE krab TO krab_user;
\\q

# Update .env file
echo "DATABASE_URL=postgresql://krab_user:your_secure_password@localhost:5432/krab" >> .env
```

### Redis Cache Setup

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Add to .env
echo "REDIS_URL=redis://localhost:6379" >> .env
```

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Show status
sudo ufw status
```

### Log Rotation

```bash
# Install logrotate
sudo apt install -y logrotate

# Create logrotate config for Krab
sudo cat > /etc/logrotate.d/krab << EOF
/home/krab/krab/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 krab krab
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

## Backup Strategy

### Automated Backups

```bash
# Create backup script
cat > ~/backup-krab.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/krab/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="krab_$DATE"

mkdir -p $BACKUP_DIR

# Backup data directory
tar -czf $BACKUP_DIR/${BACKUP_NAME}_data.tar.gz -C /home/krab/krab data/

# Backup database (if using PostgreSQL)
# pg_dump krab > $BACKUP_DIR/${BACKUP_NAME}_db.sql

# Backup configuration (without secrets)
tar -czf $BACKUP_DIR/${BACKUP_NAME}_config.tar.gz -C /home/krab/krab \
    --exclude='.env' \
    --exclude='data' \
    .

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_NAME"
EOF

chmod +x ~/backup-krab.sh

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /home/krab/backup-krab.sh
```

### Offsite Backup

```bash
# Install rclone for cloud backups
sudo apt install -y rclone

# Configure rclone (example for Google Drive)
rclone config

# Update backup script to sync to cloud
echo "rclone sync $BACKUP_DIR remote:krab-backups/" >> ~/backup-krab.sh
```

## Security Hardening

### SSH Hardening

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Recommended changes:
# Port 2222  # Change from default 22
# PermitRootLogin no
# PasswordAuthentication no
# AllowUsers krab

# Restart SSH
sudo systemctl restart ssh

# Update firewall
sudo ufw allow 2222/tcp
sudo ufw delete allow ssh  # Remove old rule
```

### Fail2Ban Setup

```bash
# Configure Fail2Ban for SSH
sudo cat > /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

# Restart Fail2Ban
sudo systemctl restart fail2ban
```

### System Updates

```bash
# Automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## Performance Optimization

### Node.js Optimization

```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=1024"

# Use PM2 cluster mode for multi-core
# Edit ecosystem.config.js
module.exports = {
  apps: [{
    name: 'krab',
    script: 'dist/index.js',
    instances: 'max',  # Use all CPU cores
    exec_mode: 'cluster',
    // ... other config
  }]
};
```

### Nginx Optimization

```bash
# Edit /etc/nginx/nginx.conf
worker_processes auto;
worker_connections 1024;

# Add gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### System Tuning

```bash
# Increase file descriptors
echo "krab soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "krab hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Kernel parameters
sudo sysctl -w net.core.somaxconn=65536
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=65536
```

## Monitoring & Alerting

### PM2 Monitoring

```bash
# PM2 web interface
pm2 install pm2-web
pm2 start pm2-web

# Access at: http://your-vps-ip:9615
```

### System Monitoring

```bash
# Install monitoring tools
sudo apt install -y prometheus-node-exporter

# System resource monitoring
htop
iotop
nmon
```

### Log Aggregation

```bash
# PM2 logs
pm2 logs

# System logs
sudo journalctl -u krab -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs krab

# Restart application
pm2 restart krab
```

#### Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### Memory Issues
```bash
# Check memory usage
htop

# PM2 memory monitoring
pm2 monit
```

#### Network Issues
```bash
# Check firewall
sudo ufw status

# Test ports
netstat -tlnp | grep :18789
netstat -tlnp | grep :3000

# Test connectivity
curl http://localhost:18789/health
```

### Performance Issues

```bash
# Check system resources
uptime
free -h
df -h

# PM2 process info
pm2 show krab

# Nginx status
sudo nginx -t
sudo systemctl status nginx
```

## Update Procedure

### Zero-Downtime Updates

```bash
# Pull latest changes
cd ~/krab
git pull

# Install dependencies
npm install

# Build application
npm run build

# Reload with PM2 (zero downtime)
pm2 reload ecosystem.config.js

# Check status
pm2 status
curl http://localhost:3000/health
```

### Rollback Procedure

```bash
# If update fails, rollback to previous version
git log --oneline -10  # Find previous commit
git checkout <commit-hash>
npm install
npm run build
pm2 reload ecosystem.config.js
```

## Cost Optimization

### VPS Selection Guide

- **Development/Testing:** $5-10/month (1GB RAM)
- **Small Production:** $10-20/month (2GB RAM)
- **Medium Production:** $20-40/month (4GB RAM)
- **Large Production:** $40+/month (8GB+ RAM)

### Cost-Saving Tips

1. **Choose Right Plan:** Don't over-provision
2. **Monitor Usage:** Use `htop`, `iotop`
3. **Optimize Code:** Reduce memory usage
4. **Use CDN:** For static assets (if any)
5. **Schedule Backups:** During off-peak hours

## Multi-Server Setup

### Load Balancer Setup

```bash
# Install HAProxy
sudo apt install -y haproxy

# Configure HAProxy
sudo cat > /etc/haproxy/haproxy.cfg << EOF
frontend krab_front
    bind *:80
    default_backend krab_back

backend krab_back
    balance roundrobin
    server krab1 127.0.0.1:18789 check
    server krab2 192.168.1.102:18789 check
EOF

sudo systemctl restart haproxy
```

### Database Replication

```bash
# Set up PostgreSQL replication
# This is advanced - consider managed databases for production
```

---

## 🚀 VPS Deployment Checklist

- [ ] Choose VPS provider and plan
- [ ] Initial server setup (user, firewall, updates)
- [ ] Install Node.js and PM2
- [ ] Deploy Krab application
- [ ] Set up Nginx reverse proxy
- [ ] Configure SSL certificate
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Test all functionality

## 📞 Support Resources

- **Krab Documentation:** https://github.com/yourusername/krab/docs
- **PM2 Documentation:** https://pm2.keymetrics.io/
- **Nginx Documentation:** https://nginx.org/en/docs/
- **Node.js Best Practices:** https://github.com/goldbergyoni/nodebestpractices

Happy deploying! 🎉
