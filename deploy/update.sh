#!/usr/bin/env bash
# Aggiorna l'hub all'ultimo commit su GitHub. Lo lancia il timer ogni 2 minuti (o tu: sudo hub-update --force).
# Compila la nuova versione in una cartella a parte: se il build fallisce, resta online quella vecchia.
set -euo pipefail

REPO="https://github.com/Brankss/gbwh.git"
APP=/opt/hub
ENV_FILE=/etc/hub.env
BRANCH="$(grep -E '^HUB_BRANCH=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
BRANCH="${BRANCH:-brankss/blissful-cray-azcc71}"

exec 9>/run/hub-update.lock
flock -n 9 || exit 0 # un aggiornamento alla volta

SHA="$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)"
[ -n "$SHA" ] || { echo "Ramo $BRANCH non trovato su GitHub"; exit 1; }
CURRENT="$(basename "$(readlink -f "$APP/current" 2>/dev/null || echo none)")"
if [ "$SHA" = "$CURRENT" ] && [ "${1:-}" != "--force" ]; then exit 0; fi

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
