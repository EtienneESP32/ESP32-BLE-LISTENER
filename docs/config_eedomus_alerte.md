# Configuration Eedomus – Alerte intrusion BLE

Pour recevoir une **alerte** dans eedomus lorsqu’un device BLE **Rouge** (intrusion) est détecté par l’ESP, **armer/désarmer** la surveillance depuis eedomus, et **afficher les infos** du BLE qui a déclenché l’alerte.

Voir aussi : **`docs/ui_et_eedomus_plan.md`** (plan détaillé UI + eedomus + identification BLE).

---

## 1. Périphériques à créer dans Eedomus

| Périphérique | Type | Rôle |
|--------------|------|------|
| **Alerte intrusion BLE** | Liste (ON/OFF) ou Binaire | Déclencher les scénarios (notification, alarme). L’ESP envoie value=100 quand une MAC Rouge est vue (système armé). |
| **Armement alerte BLE** | — | Pas un périphérique eedomus : c’est un **switch sur l’ESP**. Eedomus appelle l’ESP en HTTP pour ON/OFF (voir §2). |
| **Dernière alerte BLE – MAC** | Texte / note | Afficher la MAC qui a déclenché la dernière alerte. L’ESP met à jour ce périphérique à chaque alerte. |
| **Dernière alerte BLE – Fabricant** | Texte / note | Afficher le fabricant OUI (ou « Non trouvé »). L’ESP met à jour ce périphérique à chaque alerte. |

Noter les **IDs** des périphériques et les mettre dans `esphome/secrets.yaml` (ex. `eedomus_periph_alerte`, `eedomus_periph_alerte_mac`, `eedomus_periph_alerte_vendor`). Ne jamais committer les IDs.

---

## 2. Armer / Désarmer la surveillance BLE

L’état **armé / désarmé** est porté par l’ESP (switch « Armement alerte BLE »). Eedomus **pilote** l’ESP via HTTP :

| Action | URL (méthode POST) |
|--------|--------------------|
| Armer | `http://<IP_ESP>/api/surveillance/toggle` (Active l'arment) |
| Désarmer | `http://<IP_ESP>/api/surveillance/toggle` (Bascule l'état) |


Remplacer `<IP_ESP>` par l’IP du module BLE (ex. 192.168.1.225).  
Dans eedomus : créer un **actionneur HTTP** (ou scénario) avec deux états/actions pointant vers ces URLs. Le slug peut varier selon le `name` du switch ; en cas de doute, consulter `http://<IP_ESP>/json` pour les champs `id` des entités.

L’état armé est **restauré après redémarrage** (`restore_value: true` sur le switch côté ESP).

---

## 3. Afficher les infos du BLE qui a déclenché l’alerte

Pour afficher **quelle** MAC et **quel fabricant** ont déclenché l’alerte :

1. Créer les deux périphériques **texte** (ou « note ») : « Dernière alerte BLE – MAC » et « Dernière alerte BLE – Fabricant ».
2. Dans `secrets.yaml`, ajouter les IDs : `eedomus_periph_alerte_mac`, `eedomus_periph_alerte_vendor`.
3. Côté firmware : lors de l’envoi de l’alerte (quand une MAC Rouge est vue et système armé), en plus de `periph.value` sur le périphérique « Alerte intrusion BLE » (value=100), envoyer :
   - `periph.value` sur le périphérique « Dernière alerte BLE – MAC » = la MAC (ex. `AA:BB:CC:DD:EE:FF`) ;
   - `periph.value` sur le périphérique « Dernière alerte BLE – Fabricant » = le nom fabricant (ou « Non trouvé »).

Les caractères spéciaux dans les URLs doivent être encodés (ex. `:` → `%3A`). Tronquer si la valeur max du périphérique texte est limitée (ex. 50 caractères pour le fabricant).

---

## 4. Références

- **Secrets** : `docs/secrets_reference.md`, `esphome/secrets.yaml.example`
- **Base projet** : `docs/ble_base.md`
- **Plan détaillé** : `docs/ui_et_eedomus_plan.md`

Aucune IP, ID ou clé API ne doit figurer dans le dépôt ; tout est dans `secrets.yaml` (hors dépôt).
