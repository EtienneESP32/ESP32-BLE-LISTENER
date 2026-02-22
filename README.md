# ESP32 BLE Intrusion

Projet de **détection d’intrusion / présence** via BLE sur ESP32, avec ESPHome : sniffer BLE, whitelist/liste rouge persistantes (NVS), alerte eedomus lorsque le système est armé.

## Fonctions

- **Sniff BLE** : scan actif continu ; détection des adresses MAC.
- **Whitelist / liste rouge** : stockées en NVS (persistantes après redémarrage).
- **Alerte eedomus** : envoi d’une alerte (periph.value) lorsqu’une **MAC inconnue** est vue **et** que le système est **armé**.
- **Bouton UI** : « Armement alerte BLE » (armé = envoi d’alertes). Utilisable par eedomus via HTTP (turn_on / turn_off). État restauré après reboot.
- **UI** : dernière MAC vue, dernière MAC inconnue, affichage whitelist/liste rouge, boutons pour ajouter/retirer la dernière inconnue de la whitelist.

## Doc

- **Base BLE** : [docs/ble_base.md](docs/ble_base.md)
- **Secrets** : [docs/secrets_reference.md](docs/secrets_reference.md)
- **Eedomus (alerte + armement)** : [docs/config_eedomus_alerte.md](docs/config_eedomus_alerte.md)

## Démarrage

1. Copier `esphome/secrets.yaml.example` en `esphome/secrets.yaml` et remplir (WiFi, OTA, eedomus si besoin). Voir `docs/secrets_reference.md`.
2. Compiler et flasher (depuis la racine du projet) :
   ```bash
   esphome run esphome/ble-sniffer.yaml --device <IP_ESP>
   ```
   ou `--device COM3` (adapter selon l’OS).

## Structure

```
ESP32_BLE_INTRUSION/
├── components/
│   └── ble_persistent_lists/   # Persistance whitelist/blacklist (NVS)
├── esphome/
│   ├── ble-sniffer.yaml       # Firmware principal
│   └── secrets.yaml.example
├── docs/
│   ├── ble_base.md
│   ├── config_eedomus_alerte.md
│   └── secrets_reference.md
├── .gitignore
└── README.md
```

`secrets.yaml` ne doit pas être commité (déjà dans `.gitignore`).
