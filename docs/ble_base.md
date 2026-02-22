# Base BLE (reprise du projet MSPA)

## Origine

Cette base provient du projet **MSPA** (contrôleur spa ESP32). Le firmware BLE y avait été introduit sous le nom `ble-spa-sniff.yaml` pour du **sniffing BLE** (scan actif continu), puis retiré du dépôt MSPA lors d’un nettoyage (piste BLE abandonnée côté spa).

Le contenu BLE a été ramené ici pour servir de **base de travail** au projet **ESP32_BLE_INTRUSION** (détection d’intrusion / présence via BLE).

## Ce qui a été repris

- **Configuration ESPHome** : `esphome/ble-sniffer.yaml`
  - ESP32 (board `esp32dev`, framework Arduino)
  - WiFi, API, OTA, web_server (port 80)
  - **`esp32_ble_tracker`** avec scan actif et continu :
    - `active: true`
    - `continuous: true`
- **Secrets** : utilisation de `secrets.yaml` (wifi_ssid, wifi_password, ota_password), avec `esphome/secrets.yaml.example` comme modèle.
- **Nom du device** : `ble-intrusion-sniff` / *BLE Intrusion Sniffer* (adapté au nouveau projet).

## Fichiers

| Fichier | Rôle |
|--------|------|
| `esphome/ble-sniffer.yaml` | Firmware ESPHome BLE sniffer (base) |
| `esphome/secrets.yaml.example` | Modèle pour `secrets.yaml` (ne pas committer `secrets.yaml`) |
| `docs/ble_base.md` | Ce document |

## Compilation et flash

1. Copier `esphome/secrets.yaml.example` en `esphome/secrets.yaml` et renseigner WiFi + mot de passe OTA.
2. Compiler et flasher (remplacer `<IP_ESP>` ou utiliser le port COM) :
   ```bash
   esphome run esphome/ble-sniffer.yaml --device <IP_ESP>
   ```
   ou :
   ```bash
   esphome run esphome/ble-sniffer.yaml --device COM3
   ```

### Conserver la whitelist (et blacklist) au flash

La whitelist et la blacklist sont stockées en **NVS** (non volatile). Un flash **normal** (sans effacement complet) **conserve** la NVS : tes listes restent après mise à jour du firmware.

- **À ne pas faire** : utiliser une option du type **« Erase flash »**, **« Full chip erase »** ou `esptool -e` avant/pendant le flash. Cela efface toute la flash, y compris la NVS, et la whitelist repart à vide.
- Au démarrage, les logs affichent par exemple : `Whitelist chargee: N MAC(s)` pour confirmer que la liste a bien été rechargée depuis la NVS.

## Suite du projet

À partir de cette base, on peut par exemple :

- Exposer les appareils BLE détectés (adresses MAC, noms, RSSI) en capteurs ou en logs.
- Définir des listes de dispositifs « connus » vs « inconnus » pour la détection d’intrusion.
- Ajouter des triggers (présence, alerte) et les remonter vers une centrale (HTTP, MQTT, etc.).

Référence projet MSPA : dépôt parent (contrôleur UART, sniffer UART, `docs/protocol_mspa.md`).
