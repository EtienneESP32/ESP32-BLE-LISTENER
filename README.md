# ESP32 BLE Smart Radar — v1.3.5

Détecteur d'intrusion / présence BLE sur ESP32 avec interface Web embarquée (AsyncWebServer + LittleFS).

> **Firmware actif** : `ESP32_Smart_Radar/` (PlatformIO / C++ / NimBLE)  
> L'implémentation ESPHome (`esphome/`) est conservée pour référence mais n'est plus utilisée.

---

## Fonctionnalités (v1.3.3)

| Fonctionnalité | Détail |
|---|---|
| 🔵 Scan BLE actif | Scan continu, 10s scan / 2s pause WiFi |
| 📡 Détection avancée | Manufacturer data, Services UUID, GATT, Appearance, TX Power |
| 🏭 Lookup constructeur | Base OUI locale en PROGMEM (binaire search, ~30 000 entrées) |
| 🔗 GATT Niveau 2 | Connexion brève pour lire le vrai nom + batterie (FreeRTOS task dédiée) |
| ✅ Whitelist NVS | Persistante après coupure d'alim. Enregistre aussi nom+vendor au moment de l'ajout |
| ⏰ LastSeen NVS | Horodatage NTP de dernière vue par MAC, persistant. Flush NVS 1x/cycle de scan |
| 🔒 Mode Surveillance | Armé/désarmé, persistant en NVS. Alerte 1 seule fois par MAC détectée |
| 🚨 Alerte UI | Carte rouge pulsante + toast 5s. Uniquement pour les nouveaux appareils |
| ⚡ Boutons Bulk | "Tout autoriser" et "Tout vider" pour une gestion rapide |
| 🏎️ Optimisation | NVS Batch Save & Dirty flag pour éviter les ralentissements |
| 📐 Interface stable | DOM stable : les appareils ne sautent pas à l'écran lors des mises à jour |

---

## Architecture

```
ESP32_Smart_Radar/
├── src/
│   ├── main.cpp              # Firmware principal (tout en un)
│   └── progmem_vendors.h     # Base OUI constructeurs (PROGMEM)
├── data/                     # LittleFS (interface web)
│   ├── index.html
│   ├── script_v11.js         # Script actif
│   ├── style_v11.css         # Style actif
│   └── vendors.json          # Base JSON complémentaire
├── platformio.ini
└── README.md (ce fichier)
```

---

## Configuration

Dans `src/main.cpp`, modifier les constantes en haut de fichier :

```cpp
const char *WIFI_SSID     = "MonSSID";
const char *WIFI_PASSWORD = "MonMotDePasse";
const char *EEDOMUS_IP    = "192.168.1.242";   // IP de ta box Eedomus
const char *EEDOMUS_PERIPH_ID = "0";           // ID périphérique Eedomus (0 = désactivé)
IPAddress local_IP(192, 168, 1, 225);          // IP fixe de l'ESP32
```

---

## Compilation et Flash

```powershell
# Flash firmware + filesystem (depuis ESP32_Smart_Radar/)
$pio = "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe"
& $pio run -t upload --upload-port COM3
& $pio run -t uploadfs --upload-port COM3
```

---

## API HTTP (ESP32 à IP fixe 192.168.1.225)

| Endpoint | Méthode | Description |
|---|---|---|
| `/` | GET | Interface Web |
| `/api/devices` | GET | Liste des appareils détectés (JSON) |
| `/api/whitelist` | GET | Whitelist enrichie avec lastSeen, vendor, name |
| `/api/whitelist/add` | POST `mac=XX:XX:...` | Ajouter à la whitelist |
| `/api/whitelist/remove` | POST `mac=XX:XX:...` | Retirer de la whitelist |
| `/api/whitelist/add-all`| POST | Ajouter tous les détectés non-autorisés |
| `/api/whitelist/clear`  | POST | Vider entièrement la whitelist |
| `/api/surveillance` | GET | État surveillance `{active: bool}` |
| `/api/surveillance/toggle` | POST | Basculer armé/désarmé |
| `/api/alerts` | GET | Liste des MACs ayant déclenché une alerte |

---

## Intégration Eedomus (prochaine étape)

- L'ESP envoie une alerte via `GET http://<eedomus>/api/set?action=periph.value&periph_id=<ID>&value=<MAC>`
- L'alerte ne se déclenche que si `surveillanceActive == true`
- Une seule alerte par MAC depuis le dernier armement
- L'armement/désarmement via un bouton dans l'UI (persistant en NVS)
- Pour piloter depuis Eedomus : POST sur `/api/surveillance/toggle` depuis un scénario HTTP

Voir `docs/config_eedomus_alerte.md` et `docs/ui_et_eedomus_plan.md` pour les détails.

---

## Historique des versions

| Version | Résumé |
|---|---|
| v1.0 | Scan BLE basique, liste appareils |
| v1.2 | Lookup OUI PROGMEM, vendor data, scan actif |
| v1.2.8 | Correction 6 bugs (MS-CDP, AirPods, whitelist, UTF-8) |
| v1.2.9 | GATT client (nom + batterie), DOM stable |
| v1.3.0 | Mode Surveillance, bouton Armer/Désarmer, toast intrus |
| v1.3.1 | GATT en FreeRTOS task, NTP, lastSeen NVS, whitelist complète |
| v1.3.2 | Fix whitelist (double MAC, infos perdues au reboot), wlMetaMap NVS |
| v1.3.3 | **Fix perf critique** : NVS flush 1x/cycle au lieu de 1x/paquet BLE |
| v1.3.4 | Fix "Jamais vu" (NTP timeout), feedback immédiat UI au clic |
| v1.3.5 | **Qualité Scan** : GATT désactivé (trop perturbateur), boutons Bulk ajoutés |
