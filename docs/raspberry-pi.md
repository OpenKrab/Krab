# 🦀 Krab on Raspberry Pi

> **24/7 personal AI assistant on a tiny box that costs less than your coffee subscription.**

---

## 🎯 Goal

- 24/7 personal AI assistant
- Home automation hub
- Low-power, always-available Telegram/LINE/WhatsApp bot
- Private knowledge base (Obsidian Integration)

## 🔧 Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Board** | Raspberry Pi 4 (2GB) | Raspberry Pi 5 (4GB+) |
| **Storage** | 16GB MicroSD | USB SSD (huge improvement) |
| **Power** | Official Pi PSU | Official Pi PSU |
| **Network** | WiFi | Ethernet (more stable) |
| **Time** | ~30 minutes | ~30 minutes |

## 📋 Step-by-Step Guide

### 1) Flash the OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Choose OS: **Raspberry Pi OS Lite (64-bit)**
3. Click the gear icon (⚙️) to pre-configure:
   - Set hostname: `krab-gateway`
   - Enable SSH
   - Set username/password
   - Configure WiFi (if not using Ethernet)
4. Flash to your SD card / USB drive
5. Insert and boot the Pi

### 2) Connect via SSH

```bash
ssh user@krab-gateway
# or use the IP address
ssh user@192.168.x.x
```

### 3) System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y git curl build-essential

# Set timezone (important for cron/reminders)
sudo timedatectl set-timezone Asia/Bangkok  # Change to your timezone
```

### 4) Install Node.js 22 (ARM64)

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v22.x.x
npm --version
```

### 5) Add Swap (Important for 2GB or less)

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize for low RAM (reduce swappiness)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 6) Install Krab

#### Option A: Standard Install (Recommended)

```bash
git clone https://github.com/OpenKrab/Krab.git
cd Krab
npm install --legacy-peer-deps
npm run build
npm link  # Makes 'krab' available globally
```

#### Option B: Quick Install (npm)

```bash
npm install -g krab
```

### 7) Configure

```bash
# Create config directory
mkdir -p ~/.krab

# Copy example environment
cp .env.example .env

# Edit your API keys
nano .env
```

Add your preferred API key:

```env
# Choose one (or more):
GEMINI_API_KEY=your_key_here        # Free tier available
OPENROUTER_API_KEY=your_key_here    # Free models available
OPENAI_API_KEY=your_key_here        # Premium

# Optional: Obsidian Vault
OBSIDIAN_VAULT_PATH=/home/user/obsidian-vault

# Timezone
TZ=Asia/Bangkok
```

### 8) Run Onboarding

```bash
# Start Krab with daemon + gateway
krab gateway start --bind lan --port 18789
```

### 9) Verify Installation

```bash
# Check status
krab gateway status --deep

# Check health
krab gateway health

# Run diagnostics
krab gateway doctor

# View available tools
krab tools
```

### 10) Access from Your Laptop/Phone

#### Option A: SSH Tunnel (Quick)

```bash
# From your laptop/desktop
ssh -N -L 18789:127.0.0.1:18789 user@krab-gateway

# Then open in browser / API client
# http://localhost:18789
```

#### Option B: Tailscale (Recommended for anywhere access)

```bash
# On the Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Update Krab config
krab config set gateway.bind tailnet
krab gateway restart
```

---

## ⚡ Performance Optimizations

### Use a USB SSD (Huge Improvement)

```bash
# Check if booting from USB
lsblk
```

See [Pi USB boot guide](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#usb-mass-storage-boot)

### Speed up CLI Startup (Module Compile Cache)

```bash
grep -q 'NODE_COMPILE_CACHE' ~/.bashrc || cat >> ~/.bashrc <<'EOF'
export NODE_COMPILE_CACHE=/var/tmp/krab-compile-cache
mkdir -p /var/tmp/krab-compile-cache
export KRAB_NO_RESPAWN=1
EOF
source ~/.bashrc
```

- `NODE_COMPILE_CACHE` speeds up subsequent runs (`status`, `health`, `--help`)
- `/var/tmp` survives reboots better than `/tmp`
- `KRAB_NO_RESPAWN=1` avoids extra startup cost
- First run warms the cache; later runs benefit most

### Reduce Memory Usage

```bash
# Disable GPU memory allocation (headless)
echo 'gpu_mem=16' | sudo tee -a /boot/config.txt

# Disable Bluetooth if not needed
sudo systemctl disable bluetooth

# Disable other unused services
sudo systemctl disable cups avahi-daemon
```

### Monitor Resources

```bash
# Check memory
free -h

# Check CPU temperature
vcgencmd measure_temp

# Live monitoring
htop
```

---

## 🚀 Auto-Start on Boot

### Install as a System Service

```bash
krab gateway install
```

This automatically creates a **systemd user service** that:

- Starts Krab Gateway on boot
- Restarts on failure
- Persists after logout (with `enable-linger`)

### Manual systemd Setup (Alternative)

```bash
# Check service is enabled
systemctl --user is-enabled krab-gateway

# Enable if not
systemctl --user enable krab-gateway

# Start
systemctl --user start krab-gateway

# Keep running after logout
sudo loginctl enable-linger "$(whoami)"
```

### systemd Startup Tuning (Optional)

```bash
systemctl --user edit krab-gateway
```

Add:

```ini
[Service]
Environment=KRAB_NO_RESPAWN=1
Environment=NODE_COMPILE_CACHE=/var/tmp/krab-compile-cache
Restart=always
RestartSec=2
TimeoutStartSec=90
```

Then reload:

```bash
systemctl --user daemon-reload
systemctl --user restart krab-gateway
```

---

## 🔧 Recommended Model Setup

For Raspberry Pi, use lightweight cloud models (no local inference):

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "google/gemini-2.0-flash",
        "fallbacks": ["openrouter/free"]
      }
    }
  }
}
```

> **Tip:** Gemini 2.0 Flash is free and fast — perfect for Pi.

---

## 🐛 Troubleshooting

### Out of Memory (OOM)

```bash
# Check memory
free -h

# Add more swap (see Step 5)
# Or reduce services running on the Pi
```

### Slow Performance

- Use USB SSD instead of SD card
- Disable unused services: `sudo systemctl disable cups bluetooth avahi-daemon`
- Check CPU throttling: `vcgencmd get_throttled` (should return `0x0`)

### Service Won't Start

```bash
# Check logs
journalctl --user -u krab-gateway --no-pager -n 100

# Common fix: rebuild
cd ~/Krab
npm run build
systemctl --user restart krab-gateway
```

### ARM Binary Issues

1. Check if the binary has an ARM64 build
2. Try building from source: `npm rebuild`
3. Or use a Docker container with ARM support

### WiFi Drops

```bash
# Disable WiFi power management
sudo iwconfig wlan0 power off

# Make permanent
echo 'wireless-power off' | sudo tee -a /etc/network/interfaces
```

---

## 💰 Cost Comparison

| Setup | Monthly Cost | Note |
|-------|-------------|------|
| **Raspberry Pi 5 (4GB)** | ~$2 electricity | One-time ~$60 |
| **DigitalOcean Droplet** | $6-12/mo | Cloud, no hardware |
| **Hetzner VPS** | €4-8/mo | EU-based |
| **Oracle Cloud** | Free tier | Limited resources |
| **Home PC** | $10-30 electricity | Not always on |

> **Pi wins for 24/7 always-on personal assistant!** 🏆

---

## 🔗 See Also

- [VPS Deployment](./vps-deployment.md) — cloud alternative
- [Docker Deployment](./docker-deployment.md) — container setup
- [One-Command Install](./one-command-install.md) — quick install
