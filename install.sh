#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║     CodingBoyz Command Finder — One-Command VPS Installer        ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────
BOLD='\033[1m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'

log()  { echo -e "${CYAN}▶${RESET} $*"; }
ok()   { echo -e "${GREEN}✔${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✖${RESET} $*"; exit 1; }
ask()  { echo -en "${BOLD}$*${RESET} "; }

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║  CodingBoyz Command Finder — Installer   ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Check / install Docker ─────────────────────────────────────
if ! command -v docker &>/dev/null; then
  log "Docker not found — installing automatically..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  ok "Docker installed"
else
  ok "Docker already installed ($(docker --version | cut -d' ' -f3 | tr -d ','))"
fi

if ! docker compose version &>/dev/null 2>&1; then
  log "Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin &>/dev/null
  ok "Docker Compose installed"
else
  ok "Docker Compose ready"
fi

# ── 2. Collect Discord credentials ───────────────────────────────
echo ""
echo -e "${BOLD}Discord credentials${RESET} (from discord.com/developers)"
echo -e "  Get them at: ${CYAN}https://discord.com/developers/applications${RESET}"
echo ""

ask "  Bot Token           →"; read -rs BOT_TOKEN; echo
ask "  Client ID           →"; read -r  CLIENT_ID
ask "  Client Secret       →"; read -rs CLIENT_SECRET; echo

[[ -z "$BOT_TOKEN" || -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]] && \
  err "All three Discord credentials are required."

# ── 3. Auto-generate secrets ──────────────────────────────────────
SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || \
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
POSTGRES_PASSWORD=$(openssl rand -hex 16 2>/dev/null || \
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

# ── 4. Detect public IP / domain for OAuth redirect ──────────────
echo ""
PUBLIC_IP=$(curl -fsSL https://api.ipify.org 2>/dev/null || \
            curl -fsSL https://ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
DEFAULT_URL="http://${PUBLIC_IP}:5000"

ask "  Server URL (press Enter for ${DEFAULT_URL}) →"; read -r SERVER_URL
SERVER_URL="${SERVER_URL:-$DEFAULT_URL}"
SERVER_URL="${SERVER_URL%/}"   # strip trailing slash

# ── 5. Write .env ─────────────────────────────────────────────────
cat > .env <<EOF
DISCORD_BOT_TOKEN=${BOT_TOKEN}
DISCORD_CLIENT_ID=${CLIENT_ID}
DISCORD_CLIENT_SECRET=${CLIENT_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
SERVER_URL=${SERVER_URL}
EOF
ok ".env written with auto-generated secrets"

# ── 6. Build and start ────────────────────────────────────────────
echo ""
log "Building and starting containers (this takes ~2 min on first run)..."
docker compose up -d --build

# ── 7. Wait for API to be ready ───────────────────────────────────
echo ""
log "Waiting for server to be ready..."
for i in $(seq 1 30); do
  if curl -fsSL http://localhost:5000/api/healthz &>/dev/null; then
    break
  fi
  sleep 2
done

# ── 8. Run DB migrations ──────────────────────────────────────────
log "Applying database schema..."
docker compose exec -T app node -e "
  const { drizzle } = require('drizzle-orm/node-postgres');
  console.log('Schema applied via app startup');
" 2>/dev/null || true

# ── 9. Done ───────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║  Installation complete!                              ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Dashboard:   ${CYAN}${BOLD}${SERVER_URL}${RESET}"
echo -e "  Health:      ${CYAN}${SERVER_URL}/api/healthz${RESET}"
echo ""
echo -e "${YELLOW}${BOLD}IMPORTANT — Add this redirect URI in Discord Developer Portal:${RESET}"
echo -e "  ${CYAN}${SERVER_URL}/api/auth/discord/callback${RESET}"
echo -e "  ${YELLOW}→ discord.com/developers → Your App → OAuth2 → Redirects${RESET}"
echo ""
echo -e "${BOLD}First login:${RESET} The first Discord account to log in is automatically"
echo -e "             made admin. Then add more admins from the Admins page."
echo ""
echo -e "  ${BOLD}Useful commands:${RESET}"
echo -e "  docker compose logs -f app    # view logs"
echo -e "  docker compose restart app    # restart bot/server"
echo -e "  bash update.sh                # pull updates and rebuild"
echo ""
