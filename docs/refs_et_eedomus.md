# Références et transmission eedomus

## Lookup fabricant (OUI) via le web

Le bouton « Rechercher infos constructeur (web) » envoie l’**OUI** (3 premiers octets de la MAC, ex. `AA:BB:CC`) à l’API [macvendors.com](https://macvendors.com/api). Si la réponse contient une erreur (`"error"`, `"Not Found"`, `"detail"`), on affiche « Non trouvé ». En cas de limite ou d’indisponibilité, tu peux utiliser une autre source (ex. [macaddress.io](https://macaddress.io/api) avec clé API, ou une base OUI locale).

## Version dans l’UI

Le numéro de version est défini dans `esphome/ble-sniffer.yaml` via la substitution `ble_version` (ex. `"1.0.0"`). Il apparaît dans le **titre de l’interface** (friendly_name), par exemple : *BLE Intrusion Sniffer 1.0.0*.

Pour changer la version : modifier la ligne `ble_version: "x.y.z"` en tête des `substitutions`.

---

## Projets similaires (GitHub) pour s’inspirer

Projets utiles pour améliorer la **détection** et l’**identification** BLE :

| Projet | Lien | Intérêt |
|--------|------|--------|
| **ESPresense** | [github.com/ESPresense/ESPresense](https://github.com/ESPresense/ESPresense) | Détection de présence par BLE, RSSI, filtrage par MAC, identification par empreinte (fingerprint), oubli après timeout. MQTT. Très documenté (espresense.com). |
| **ESPHome Apple Watch detection** | [github.com/dalehumby/ESPHome-Apple-Watch-detection](https://github.com/dalehumby/ESPHome-Apple-Watch-detection) | ESPHome, présence BLE, idées pour filtrage et scénarios. |
| **Home Assistant BLE Presence** | [github.com/neilanthunblom/Home-Assistant-BLE-Presence-Detection](https://github.com/neilanthunblom/Home-Assistant-BLE-Presence-Detection) | Configs ESPresense + MQTT pour présence par pièce. |
| **ESP32 BLE Beacon Scanner** (omarghader) | Articles / configs ESPHome avec scan BLE, RSSI, seuils de distance, capteurs binaires de présence. | Filtrage par MAC, seuil RSSI pour “proche” vs “loin”. |

**Pistes d’amélioration inspirées de ces projets :**

- **RSSI** : utiliser la force du signal (RSSI) pour filtrer les appareils trop loin ou pour estimer une “distance” (avec calibration).
- **Filtrage / oubli** : timeout “forget” (ex. 5 min) pour ne plus considérer une MAC comme présente après absence de paquets.
- **Identification** : au-delà de l’OUI (fabricant), regarder les *fingerprints* BLE (ESPresense) ou les identifiants dans les annonces pour mieux distinguer les appareils (notamment adresses aléatoires).
- **MQTT** : si tu ajoutes un broker MQTT, tu peux publier les événements BLE (MAC, RSSI, inconnu/connu) et laisser eedomus ou un autre système s’abonner (voir aussi transmission eedomus ci‑dessous).

---

## Transmettre les données vers eedomus

Aujourd’hui, le firmware envoie déjà une **alerte** à eedomus quand une MAC **inconnue** est vue et que l’armement est activé : appel HTTP du type :

`/api/set?api_user=...&api_secret=...&action=periph.value&periph_id=...&value=100`

Donc un **périphérique eedomus** (ex. capteur numérique ou action) reçoit la valeur 100 à chaque alerte.

### Options pour aller plus loin

1. **Garder l’existant (recommandé pour l’alerte)**  
   Un seul périphérique “Alerte BLE” avec `value=100` à chaque intrusion. C’est simple et suffisant pour déclencher un scénario eedomus (notification, alarme, etc.).

2. **Envoyer la dernière MAC inconnue (ou une liste) en texte**  
   - Si l’API eedomus permet de mettre à jour un **périphérique de type texte/string** (à vérifier dans la doc eedomus : *Contrôle HTTP*, *API*, *périphériques*), on pourrait ajouter dans le firmware une requête qui envoie la dernière MAC (ou une chaîne du type “MAC1; MAC2; …”) en plus de l’alerte 100.  
   - Sinon, tu peux créer **plusieurs périphériques** (ex. “Dernière MAC 1”, “Dernière MAC 2”, …) et envoyer une valeur numérique codée ou un code par MAC (moins lisible mais possible).

3. **Déclencher un script eedomus avec paramètre**  
   - Si eedomus permet d’appeler un **script** via une URL avec paramètres (ex. `?mac=AA:BB:CC:DD:EE:FF`), le firmware pourrait faire un GET/POST vers cette URL avec la MAC en paramètre. Le script eedomus lirait le paramètre et mettrait à jour des variables / périphériques / scénarios.  
   - À configurer côté eedomus (type “HTTP” ou “Script” selon la doc).

4. **Passer par un relais (MQTT, autre box)**  
   - Le firmware envoie les événements BLE (MAC, inconnu/connu, optionnellement RSSI) vers un broker MQTT ou un autre service.  
   - Un script ou une box intermédiaire (PC, Raspberry, autre) lit le MQTT et appelle l’API eedomus pour mettre à jour des périphériques ou déclencher des scénarios.  
   - Utile si tu veux envoyer beaucoup d’infos (liste des 10 derniers inconnus, noms, etc.) sans tout faire tenir dans un seul “periph.value”.

**En pratique :**  
- Pour **alerte simple** : garder `periph.value = 100` sur un périphérique dédié.  
- Pour **voir la MAC ou une liste dans eedomus** : vérifier dans la doc eedomus s’il existe un type “capteur texte” ou “variable” mis à jour par API, ou un “module HTTP” / “script” appelable par URL avec paramètres ; ensuite on peut ajouter dans le firmware l’appel HTTP correspondant (même format que l’alerte, avec l’action et les paramètres adaptés).

Documentation eedomus à consulter : [doc.eedomus.com](https://doc.eedomus.com/) (Contrôle HTTP, API, Identifiants des périphériques).
