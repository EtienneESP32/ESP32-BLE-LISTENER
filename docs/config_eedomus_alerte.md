# Configuration Eedomus – Alerte BLE Intrusion

L’ESP envoie une **alerte vers Eedomus** (API `periph.value`) lorsqu’un **nouvel appareil BLE inconnu** est détecté **et** que le **système est armé**. L’armement se fait via un interrupteur dans l’UI (ou par push HTTP depuis Eedomus).

## Comportement

- **Sniff BLE** : scan continu ; toute MAC vue est comparée à la **whitelist**.
- **Whitelist** : liste de MAC autorisées (persistée en NVS, survivant au redémarrage). Les appareils dans la whitelist ne déclenchent pas d’alerte.
- **Liste rouge (blacklist)** : liste persistée séparément (pour usage futur : MAC à toujours considérer comme intrus).
- **Armement** : switch « Armement alerte BLE ». Quand **ON** → si une MAC **non whitelistée** est vue, l’ESP envoie une requête HTTP à Eedomus pour mettre à jour le périphérique d’alerte (value = 100). Quand **OFF** → aucune alerte envoyée.
- **Throttle** : même MAC inconnue ne déclenche pas une nouvelle alerte avant 5 minutes (évite le spam).

## Périphérique Eedomus pour l’alerte

1. Dans Eedomus, créer un **périphérique** (ex. « Alerte BLE Intrusion »).
2. Type : **Liste** ou **Valeur** selon ton usage (ex. 0 = pas d’alerte, 100 = alerte).
3. Noter l’**ID numérique** du périphérique et le mettre dans `esphome/secrets.yaml` sous la clé **`eedomus_periph_alert`** (en chaîne, ex. `"123"`).

## Secrets requis

| Clé | Usage |
|-----|--------|
| `eedomus_host` | IP ou hostname de la box eedomus |
| `eedomus_api_user` | Utilisateur API eedomus |
| `eedomus_api_secret` | Secret API eedomus |
| `eedomus_periph_alert` | ID du périphérique eedomus qui reçoit la valeur d’alerte (ex. `"123"`) |

Voir `docs/secrets_reference.md` pour la liste complète.

## Piloter l’armement depuis Eedomus (HTTP)

Eedomus peut armer/désarmer l’envoi d’alertes en appelant le **serveur web** de l’ESP (port 80) :

| Action | URL (méthode GET ou POST) |
|--------|---------------------------|
| Armer l’alerte | `http://<IP_ESP>/switch/armement_alerte_ble/turn_on` |
| Désarmer l’alerte | `http://<IP_ESP>/switch/armement_alerte_ble/turn_off` |

Remplacer `<IP_ESP>` par l’IP de l’ESP (DHCP ou IP fixe). Le slug peut varier selon le `name` du switch ; en cas de doute, consulter `http://<IP_ESP>/json` pour les champs `id` des entités.

L’état **armé / désarmé** est **restauré après redémarrage** (`restore_value: true` sur le switch).

## Persistance des listes

- **Whitelist** et **liste rouge** sont stockées en **NVS** (ESP32). Elles survivent aux redémarrages et aux coupures de courant.
- L’UI affiche les listes et permet d’**ajouter** ou **retirer** la « dernière MAC inconnue » de la whitelist via des boutons.

## Référence firmware

- Fichier : `esphome/ble-sniffer.yaml`
- Composant persistance : `components/ble_persistent_lists/`
