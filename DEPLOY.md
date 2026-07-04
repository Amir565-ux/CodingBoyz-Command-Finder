# VPS Deployment Guide — CodingBoyz Command Finder

This guide covers hosting the bot and dashboard on your own VPS (Ubuntu/Debian).

---

## Prerequisites

- A VPS running Ubuntu 22.04+ (DigitalOcean, Hetzner, Linode, AWS EC2, etc.)
- A domain name pointed at the VPS IP (optional but recommended for HTTPS)
- Docker + Docker Compose installed on the VPS

---

## Step 1 — Install Docker on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

Install Docker Compose plugin:
```bash
sudo apt-get install -y docker-compose-plugin
docker compose version   # confirm it works
```

---

## Step 2 — Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/codingboyz-command-finder.git
cd codingboyz-command-finder
```

---

## Step 3 — Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Fill in all values:

| Variable | Where to get it |
|---|---|
| `DISCORD_BOT_TOKEN` | discord.com/developers → Your App → Bot → Token |
| `DISCORD_CLIENT_ID` | discord.com/developers → General Information → Application ID |
| `DISCORD_CLIENT_SECRET` | discord.com/developers → OAuth2 → Client Secret |
| `POSTGRES_PASSWORD` | Choose any strong password |
| `SESSION_SECRET` | Generate with: `openssl rand -hex 32` |

---

## Step 4 — Add OAuth2 Redirect URI

In the Discord Developer Portal, go to **OAuth2 → Redirects** and add:

```
http://YOUR_VPS_IP:5000/api/auth/discord/callback
```

Or if you have a domain with HTTPS:
```
https://yourdomain.com/api/auth/discord/callback
```

---

## Step 5 — Build and Start

```bash
docker compose up -d --build
```

Check it's running:
```bash
docker compose ps
docker compose logs -f app
```

The dashboard will be available at: **http://YOUR_VPS_IP:5000**

---

## Step 6 — Run Database Migrations

On the first run, push the schema:

```bash
docker compose exec app sh -c "cd /app && npx drizzle-kit push --config lib/db/drizzle.config.ts"
```

---

## Step 7 — Set Up Your First Admin

1. Open the dashboard in your browser
2. Click **Initiate OAuth** to log in with Discord
3. You will be logged in but with no admin access yet
4. SSH into the VPS and manually insert yourself as the first admin:

```bash
docker compose exec db psql -U codingboyz -d codingboyz -c \
  "INSERT INTO admins (discord_id, username, added_by) VALUES ('YOUR_DISCORD_ID', 'YourUsername', 'system');"
```

Replace `YOUR_DISCORD_ID` with your Discord User ID (enable Developer Mode in Discord → right-click your name → Copy User ID).

5. Log out and log back in — you now have admin access
6. From the **Admins** page in the dashboard, add other admins without touching the database again

---

## Step 8 — (Optional) HTTPS with Nginx + Certbot

Install Nginx and Certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/codingboyz`:
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it and get a certificate:
```bash
sudo ln -s /etc/nginx/sites-available/codingboyz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com
```

Update your Discord OAuth2 redirect URI to `https://yourdomain.com/api/auth/discord/callback`.

---

## Maintenance

**View logs:**
```bash
docker compose logs -f app     # app logs
docker compose logs -f db      # database logs
```

**Restart after code changes:**
```bash
git pull
docker compose up -d --build
```

**Stop everything:**
```bash
docker compose down
```

**Backup the database:**
```bash
docker compose exec db pg_dump -U codingboyz codingboyz > backup_$(date +%Y%m%d).sql
```

**Restore a backup:**
```bash
cat backup_20240101.sql | docker compose exec -T db psql -U codingboyz -d codingboyz
```

---

## Invite the Bot to Your Server

1. Open the dashboard → **Install** page
2. Click **Add to Discord Server** (or copy the invite URL)
3. Select your server and authorize

The bot needs: **Send Messages**, **Read Message History**, **View Channels**, **Use Application Commands**

---

## Slash Commands

Slash commands are registered globally and may take up to **1 hour** to appear in Discord after the first start. They will update automatically whenever the app restarts.

| Command | Who can use |
|---|---|
| `/cmdfinder get name:<name>` | Everyone |
| `/cmdfinder add name:<n> summary:<desc>` | Discord Admins / Manage Server |
| `/cmdfinder help` | Everyone |
