#!/usr/bin/env bash
# Controllo veloce dell'hub sulla VM: poche righe in italiano, da leggere (o fotografare) al volo.
ok() { printf '\033[1;32m✔\033[0m %s\n' "$*"; }
ko() { printf '\033[1;31m✘\033[0m %s\n' "$*"; }

if [ ! -f /etc/hub.env ]; then ko "Manca /etc/hub.env: incolla prima il comando con le variabili."; exit; fi
if [ ! -f /etc/systemd/system/hub.service ]; then ko "L'installazione non è stata fatta: lancia setup.sh."; exit; fi
HOST="$(grep -E '^SITE_HOST=' /etc/hub.env | cut -d= -f2-)"

if systemctl is-active -q hub && curl -fsS -o /dev/null -m 5 http://127.0.0.1:3000/login; then ok "Hub acceso."
elif [ ! -e /opt/hub/current ]; then ko "Il sito non è ancora stato compilato: sudo hub-update --force"
else ko "Hub spento o in errore. Causa: $(journalctl -u hub -n 30 --no-pager | grep -iE 'error|errore' | tail -1 | cut -c1-160)"; fi

if ! systemctl is-active -q caddy; then ko "Caddy (HTTPS) spento: sudo systemctl restart caddy"
elif journalctl -u caddy --since "-2h" --no-pager | grep -q "certificate obtained successfully"; then ok "Certificato HTTPS ok."
elif journalctl -u caddy --since "-2h" --no-pager | grep -qiE "timeout|connection refused|challenge failed|could not get certificate|no route"; then
  ko "HTTPS bloccato: su Azure apri in ingresso le porte 80 e 443 (VM > Rete > Aggiungi regola porta in ingresso)."
else ok "Caddy acceso (certificato in arrivo o già presente)."; fi

grep -q '^SMTP_PASS=.' /etc/hub.env && ok "Sveglia email configurata." || printf '• Sveglia email non configurata (facoltativa).\n'
echo "Sito: https://$HOST"
