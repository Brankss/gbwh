# Hub sulla tua VM

Installazione una volta sola su Ubuntu/Debian; poi si aggiorna da sola a ogni push su GitHub (controllo ogni 2 minuti).

1. Variabili in `/etc/hub.env` (una per riga, `NOME=valore`): `APP_PASSWORD`, `INBOUND_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, e se vuoi la sveglia email `WAKE_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, più `AA_API_KEY` per i modelli.
2. `curl -fsSL https://raw.githubusercontent.com/Brankss/gbwh/brankss/blissful-cray-azcc71/deploy/setup.sh -o setup.sh && sudo bash setup.sh`
3. Su Azure apri in ingresso le porte **80** e **443** (VM → Rete → Aggiungi regola porta in ingresso).

Il sito è su `https://<ip-con-trattini>.sslip.io` (oppure il dominio in `SITE_HOST`). Caddy prende il certificato HTTPS da solo.

Comandi utili:

| Cosa | Comando |
|---|---|
| Stato | `systemctl status hub` |
| Log | `journalctl -u hub -f` |
| Forza un aggiornamento | `sudo hub-update --force` |
| Cambia una variabile | `sudo nano /etc/hub.env`, poi `sudo systemctl restart hub` |

I media caricati stanno in `/var/lib/hub/media`.
