# Référence des secrets (BLE Intrusion)

Fichier concerné : `esphome/secrets.yaml` (créé à partir de `esphome/secrets.yaml.example`). Ne jamais committer `secrets.yaml`.

| Clé | Fichier | Usage |
|-----|---------|--------|
| `wifi_ssid` | ble-sniffer.yaml | SSID du réseau Wi‑Fi |
| `wifi_password` | ble-sniffer.yaml | Mot de passe Wi‑Fi |
| `ota_password` | ble-sniffer.yaml | Mot de passe OTA (mise à jour firmware) |
| `ap_ssid` | ble-sniffer.yaml | SSID du point d’accès de secours (si Wi‑Fi injoignable) |
| `ap_password` | ble-sniffer.yaml | Mot de passe du point d’accès de secours |
| `eedomus_host` | ble-sniffer.yaml | IP ou hostname de la box eedomus (alerte BLE) |
| `eedomus_api_user` | ble-sniffer.yaml | Utilisateur API eedomus |
| `eedomus_api_secret` | ble-sniffer.yaml | Secret API eedomus |
| `eedomus_periph_alert` | ble-sniffer.yaml | ID du périphérique eedomus pour l’alerte (chaîne, ex. `"123"`) |
| `static_ip` | ble-sniffer.yaml | (Optionnel) IP fixe – décommenter `manual_ip` dans le YAML |
| `gateway` | ble-sniffer.yaml | (Optionnel) Passerelle – avec IP fixe |
| `subnet` | ble-sniffer.yaml | (Optionnel) Masque – avec IP fixe |

Pour connecter le prototype au Wi‑Fi : renseigner au minimum `wifi_ssid` et `wifi_password`. Pour l’alerte eedomus : `eedomus_host`, `eedomus_api_user`, `eedomus_api_secret`, `eedomus_periph_alert`. Voir `docs/config_eedomus_alerte.md`.
