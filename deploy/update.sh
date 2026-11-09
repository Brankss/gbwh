#!/usr/bin/env bash
# Aggiorna l'hub all'ultimo commit su GitHub. Lo lancia il timer ogni 2 minuti (o tu: sudo hub-update --force).
# Compila la nuova versione in una cartella a parte: se il build fallisce, resta online quella vecchia.
# A ogni giro controlla anche che indirizzo del sito e HTTPS (Caddy) siano giusti.
set -euo pipefail

REPO="https://github.com/Brankss/gbwh.git"
APP=/opt/hub
ENV_FILE=/etc/hub.env
BRANCH="$(grep -E '^HUB_BRANCH=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
BRANCH="${BRANCH:-brankss/blissful-cray-azcc71}"

exec 9>/run/hub-update.lock
flock -n 9 || exit 0 # un aggiornamento alla volta

envget() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
envset() {
  if grep -qE "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >>"$ENV_FILE"; fi
}

# IP pubblico: prima chiediamo ad Azure (affidabile), poi a un servizio esterno.
public_ip() {
  curl -fsS -m 3 -H Metadata:true \
    "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text" 2>/dev/null ||
    curl -fsS -m 5 https://api.ipify.org 2>/dev/null || true
}

# Indirizzo del sito + configurazione HTTPS. Restituisce 0 se ha cambiato qualcosa che richiede di riavviare l'hub.
ensure_web() {
  local changed=1 host ip auto
  host="$(envget SITE_HOST)"
  ip="$(public_ip)"
  # Il nome automatico (IP con trattini + .sslip.io) segue l'IP vero della VM; un dominio scelto da te non si tocca.
  if [ -n "$ip" ]; then
    auto="${ip//./-}.sslip.io"
    if [ -z "$host" ] || { [[ "$host" == *.sslip.io ]] && [ "$host" != "$auto" ]; }; then
      host="$auto"
      envset SITE_HOST "$host"
      envset SITE_URL "https://$host"
      changed=0
    fi
  fi
  [ -n "$host" ] || return 1

  # Qualsiasi indirizzo apri (IP diretto, http, nome vecchio) ti porta al sito giusto: niente pagine vuote.
  local tmp
  tmp="$(mktemp)"
  cat >"$tmp" <<CADDY
$host {
	encode zstd gzip
	request_body {
		max_size 120MB
	}
	reverse_proxy 127.0.0.1:3000
}

:80 {
	redir https://$host{uri} permanent
}
CADDY
  if ! cmp -s "$tmp" /etc/caddy/Caddyfile; then
    if caddy validate --adapter caddyfile --config "$tmp" >/dev/null 2>&1; then
      install -m 644 "$tmp" /etc/caddy/Caddyfile
      systemctl reload caddy 2>/dev/null || systemctl restart caddy
      echo "HTTPS aggiornato per https://$host"
    else
      echo "Configurazione HTTPS non valida, lascio quella di prima."
    fi
  fi
  rm -f "$tmp"
  return $changed
}

restart_needed=1
if command -v caddy >/dev/null && ensure_web; then restart_needed=0; fi

SHA="$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)"
[ -n "$SHA" ] || { echo "Ramo $BRANCH non trovato su GitHub"; exit 1; }
CURRENT="$(basename "$(readlink -f "$APP/current" 2>/dev/null || echo none)")"
if [ "$SHA" = "$CURRENT" ] && [ "${1:-}" != "--force" ]; then
  [ "$restart_needed" = 0 ] && systemctl restart hub
  exit 0
fi

REL="$APP/releases/$SHA"
if [ ! -f "$REL/.next/BUILD_ID" ]; then
  echo "Nuova versione $SHA: scarico e compilo…"
  rm -rf "$REL"
  sudo -u hub git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$REL"
  if ! sudo -u hub -H bash -c "cd '$REL' && export NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 && npm ci --no-audit --no-fund --loglevel=error && npm run build"; then
    echo "Build fallito: resta online la versione precedente."
    rm -rf "$REL"
    exit 1
  fi
fi

ln -sfn "$REL" "$APP/current.new" && mv -Tf "$APP/current.new" "$APP/current"

# Gli script di servizio arrivano con il codice: si aggiornano da soli.
install -m 755 "$REL/deploy/update.sh" /usr/local/bin/hub-update
[ -f "$REL/deploy/check.sh" ] && install -m 755 "$REL/deploy/check.sh" /usr/local/bin/hub-check
for f in hub.service hub-update.service hub-update.timer; do
  if ! cmp -s "$REL/deploy/$f" "/etc/systemd/system/$f"; then
    install -m 644 "$REL/deploy/$f" "/etc/systemd/system/$f"
    systemctl daemon-reload
  fi
done

systemctl restart hub 2>/dev/null || true

# Tieni solo le ultime 3 versioni.
ls -1dt "$APP"/releases/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
echo "Online: $SHA"
