# Plan UI + Eedomus — v1.3.3

> Document de travail mis à jour au 2026-02-28. Reflète l'état actuel du projet.

---

## 1. État actuel de l'UI (v1.3.3)

### Ce qui est en place ✅

- **Liste détectée** : DOM stable (pas de reordonnancement). Affiche MAC, nom (GATT si dispo), constructeur, badges (type adresse, appearance, Mfg data décodée, services, batterie). Bouton ✅ Autoriser par appareil.
- **Liste blanche** : Tous les appareils autorisés affichés en permanence, même hors portée. Affiche le nom et vendor sauvegardés au moment de l'ajout (NVS). Badge `🟢 En ligne` quand l'appareil est actuellement détecté. Badge horodatage `lastSeen` coloré (🟢 récent / 🟡 heures / 🔴 jours / ⚫ jamais).
- **Mode Surveillance** : Bouton 🔒 Armer / 🔓 Désarmer dans le header. Persistant en NVS. Alerte 1 fois par MAC depuis le dernier armement. Pas d'alerte pour les appareils déjà présents au chargement de la page.
- **Toast d'alerte** : Popup 5s non bloquant pour les nouveaux intrus. Carte rouge pulsante persistante.

### Ce qui reste à faire 🚧

- **Intégration Eedomus** : L'envoi HTTP à Eedomus est implémenté mais désactivé (`EEDOMUS_PERIPH_ID = "0"`). À activer quand l'ID est configuré.
- **Historique des alertes** : Actuellement en mémoire uniquement (perdu au redémarrage). Pourrait être persisté en NVS.

---

## 2. Eedomus : Intégration prévue

### 2.1 Armer / Désarmer depuis Eedomus

L'ESP expose deux endpoints. Eedomus peut les appeler via un scénario HTTP :

```
# Armer
POST http://192.168.1.225/api/surveillance/toggle

# Lire l'état
GET http://192.168.1.225/api/surveillance
# → {"active": true}
```

Pour un contrôle propre depuis Eedomus : créer un **actionneur HTTP** avec deux états (ON/OFF) et deux URLs. L'ESP reste la source de vérité (état persistant en NVS).

### 2.2 Recevoir l'alerte dans Eedomus

Quand surveillance active + nouvel intrus détecté, l'ESP appelle :
```
GET http://<eedomus>/api/set?action=periph.value
    &periph_id=<ID_ALERTE>
    &value=<MAC>
    &api_user=<USER>
    &api_secret=<SECRET>
```

**Périphériques Eedomus à créer** :
| Besoin | Type Eedomus | ID à configurer |
|---|---|---|
| Déclencher alerte | Texte ou Binaire | `EEDOMUS_PERIPH_ID` dans main.cpp |
| MAC de l'intrus | Texte | (optionnel, peut être `value` du même périph) |

### 2.3 Roadmap Eedomus

1. Créer le périphérique dans Eedomus → récupérer son ID
2. Modifier `EEDOMUS_PERIPH_ID` dans `main.cpp`
3. Compiler et flasher
4. Tester en armant et en approchant un appareil non whitelisté
5. Créer un scénario Eedomus qui se déclenche sur changement du périphérique alerte

---

## 3. Performances et stabilité

### NVS — Politique de sauvegarde actuelle

| Donnée | Fréquence d'écriture | Clé NVS |
|---|---|---|
| Whitelist (liste MACs) | À chaque ajout/suppression | `whitelist` |
| Whitelist meta (nom/vendor) | À chaque ajout | `wlmeta` |
| LastSeen timestamps | **1 fois par cycle de scan (~12s)** | `lastseen` |
| Mode surveillance | À chaque changement | `surveillance` |

> ⚠️ Avant v1.3.3, `lastSeen` était sauvegardé à chaque paquet BLE reçu → des centaines de fois par seconde → l'ESP était non réactif. Corrigé en v1.3.3.

### GATT — Politique de connexion

- 🛑 **Désactivé en v1.3.5** : Le client GATT (pour lire le nom complet et la batterie) monopolisait la radio BLE et provoquait des "trous" dans le scan.
- Le scan actif actuel récupère déjà ~80% des noms via les paquets d'advertisement sans dégrader la performance.
- Pourrait être réactivé plus tard via une fenêtre de pause dédiée, mais la priorité est donnée à la qualité de détection.
