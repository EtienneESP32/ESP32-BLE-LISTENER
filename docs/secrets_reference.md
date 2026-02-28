# Référence des secrets (BLE Intrusion)

Fichier concerné : `esphome/secrets.yaml` (créé à partir de `esphome/secrets.yaml.example`). Ne jamais committer `secrets.yaml`.

## Alignement avec MSPA

Les secrets **Wi‑Fi** et **eedomus** (host, api_user, api_secret) sont les mêmes que dans le projet **MSPA** (`MSPA/esphome/secrets.yaml`). On peut les recopier depuis le fichier secrets de MSPA pour garder la cohérence (même réseau, même box eedomus). Les clés **spécifiques BLE** sont : `ota_password`, `ap_ssid` (ex. `BLE-INTRUSION-RECOVERY`), `eedomus_periph_alerte`, et l’IP fixe du module (`static_ip` = 192.168.1.225).

**OTA** : pour envoyer le firmware sans câble, utiliser l’adresse IP **actuelle** du module (ex. `192.168.1.132`) jusqu’à ce qu’il ait reçu un flash avec `manual_ip` → il passera alors en 192.168.1.225.

```bash
py -3 -m esphome run esphome/ble-sniffer.yaml --device 192.168.1.132
```

---

| Clé | Source | Usage |
|-----|--------|--------|
| `wifi_ssid` | MSPA | SSID du réseau Wi‑Fi |
| `wifi_password` | MSPA | Mot de passe Wi‑Fi |
| `ota_password` | BLE | Mot de passe OTA (mise à jour firmware) |
| `ap_ssid` | BLE | SSID du point d’accès de secours (ex. `BLE-INTRUSION-RECOVERY`) |
| `ap_password` | MSPA | Mot de passe du point d’accès de secours |
| `eedomus_enabled` | MSPA | `"true"` / `"false"` – activer/désactiver push eedomus |
| `eedomus_host` | MSPA | IP ou hostname de la box eedomus |
| `eedomus_api_user` | MSPA | Utilisateur API eedomus |
| `eedomus_api_secret` | MSPA | Secret API eedomus |
| `eedomus_periph_alerte` | BLE | ID du périphérique eedomus « Alerte intrusion BLE » (nombre) |
| `static_ip` | BLE | IP fixe du module BLE (ex. `192.168.1.225`) |
| `gateway` | MSPA | Passerelle (ex. `192.168.1.1`) |
| `subnet` | MSPA | Masque (ex. `255.255.255.0`) |

Pour connecter le module au Wi‑Fi : au minimum `wifi_ssid` et `wifi_password`. Pour l’alerte eedomus : `eedomus_host`, `eedomus_api_user`, `eedomus_api_secret`, `eedomus_periph_alerte`. Voir `docs/config_eedomus_alerte.md`.
