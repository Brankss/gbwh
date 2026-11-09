#!/usr/bin/env bash
# Installa l'hub su una VM Ubuntu/Debian, una volta sola (rilanciarlo non fa danni):
#   - Node.js 22, Caddy (HTTPS automatico con Let's Encrypt), aggiornamenti di sicurezza automatici;
#   - l'hub come servizio (riparte da solo se crasha o se la VM si riavvia);
#   - aggiornamento automatico: ogni 2 minuti controlla GitHub e, se c'è un commit nuovo,
#     lo compila a parte e passa alla nuova versione solo se il build riesce.
# Prima va creato /etc/hub.env con le variabili (vedi deploy/README.md).
set -euo pipefail

REPO="https://github.com/Brankss/gbwh.git"
APP=/opt/hub
DATA=/var/lib/hub
ENV_FILE=/etc/hub.env
RAW="https://raw.githubusercontent.com/Brankss/gbwh"

log() { printf '\n\033[1;37m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERRORE: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "lancialo con sudo: sudo bash setup.sh"
. /etc/os-release
case "$ID" in ubuntu | debian) ;; *) die "serve Ubuntu o Debian (trovato: $ID)" ;; esac
[ -f "$ENV_FILE" ] || die "manca $ENV_FILE con le variabili dell'hub (vedi le istruzioni)"
grep -q '^APP_PASSWORD=.' "$ENV_FILE" || die "in $ENV_FILE manca APP_PASSWORD"
grep -q '^UPSTASH_REDIS_REST_URL=.' "$ENV_FILE" || die "in $ENV_FILE manca UPSTASH_REDIS_REST_URL (senza, i dati si perdono a ogni riavvio)"

BRANCH="$(grep -E '^HUB_BRANCH=' "$ENV_FILE" | cut -d= -f2- || true)"
BRANCH="${BRANCH:-brankss/blissful-cray-azcc71}"

log "Pacchetti di base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades || true

log "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

log "Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

log "Memoria di scorta (per compilare anche con poca RAM)"
if [ "$(free -m | awk '/Mem:/{print $2}')" -lt 3500 ] && ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

log "Utente e cartelle"
id hub >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/hub --shell /usr/sbin/nologin hub
mkdir -p "$APP/releases" "$DATA/media"
chown -R hub:hub "$APP" "$DATA"

log "Variabili di base"
grep -q '^MEDIA_DIR=' "$ENV_FILE" || echo "MEDIA_DIR=$DATA/media" >>"$ENV_FILE"
grep -q '^MAX_UPLOAD_MB=' "$ENV_FILE" || echo "MAX_UPLOAD_MB=100" >>"$ENV_FILE"
chown root:hub "$ENV_FILE"
chmod 640 "$ENV_FILE"

log "Servizi"
curl -fsSL "$RAW/$BRANCH/deploy/update.sh" -o /usr/local/bin/hub-update
chmod 755 /usr/local/bin/hub-update
curl -fsSL "$RAW/$BRANCH/deploy/check.sh" -o /usr/local/bin/hub-check
chmod 755 /usr/local/bin/hub-check
curl -fsSL "$RAW/$BRANCH/deploy/hub.service" -o /etc/systemd/system/hub.service
curl -fsSL "$RAW/$BRANCH/deploy/hub-update.service" -o /etc/systemd/system/hub-update.service
curl -fsSL "$RAW/$BRANCH/deploy/hub-update.timer" -o /etc/systemd/system/hub-update.timer
systemctl daemon-reload

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp && ufw allow 443/tcp
fi

systemctl enable caddy

log "Primo build (qualche minuto). Indirizzo e HTTPS si configurano da soli."
/usr/local/bin/hub-update --force

systemctl enable --now hub
systemctl enable --now hub-update.timer
HOST="$(grep -E '^SITE_HOST=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
[ -n "$HOST" ] || die "non riesco a sapere l'IP pubblico: aggiungi SITE_HOST=<dominio> in $ENV_FILE e rilancia"

log "Controllo"
sleep 4
if curl -fsS -o /dev/null "http://127.0.0.1:3000/login"; then echo "Hub acceso sulla VM."; else echo "L'hub non risponde ancora: guarda 'journalctl -u hub -n 50'"; fi
echo
echo "Fatto. Il sito sarà su:  https://$HOST   (controllo veloce: sudo hub-check)"
echo "Se non si apre: su Azure apri le porte 80 e 443 in ingresso (VM > Rete > Aggiungi regola porta in ingresso),"
echo "poi aspetta un minuto che Caddy prenda il certificato (log: journalctl -u caddy -n 50)."
