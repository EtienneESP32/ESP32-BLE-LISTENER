# Sites et APIs pour identifier les appareils BLE (OUI / fabricant)

Les adresses BLE utilisent le même format OUI que l'Ethernet. Les services ci‑dessous permettent d'obtenir le **fabricant** à partir d'une MAC ou des 6 premiers caractères hex (OUI).

---

## APIs gratuites (sans clé ou quota raisonnable)

| Service | URL / Endpoint | Usage |
|--------|----------------|--------|
| **MACVendors.com** *(actuel)* | https://macvendors.com/api | GET `https://api.macvendors.com/<MAC ou OUI>`. Jusqu'à 1000 req/jour, 1 req/s. Pas d'inscription. Réponse texte = nom fabricant. |
| **macvendorlookup.com** | https://www.macvendorlookup.com/mac-address-api | GET `https://www.macvendorlookup.com/api/v2/<MAC>`. Min. 6 car. hex. Réponse JSON (fabricant, adresse, pays). Gratuit. |
| **maclookup.app** | https://maclookup.app/api-v2/documentation | GET `https://api.maclookup.app/v2/macs/<MAC>`. 10k req/j sans clé (2 req/s) ; avec clé gratuite : 1 M req/j, 50 req/s. JSON. Base IEEE + Wireshark. |
| **oui.is** | https://oui.is/ | Recherche MAC/OUI, base mise à jour toutes les 12 h depuis IEEE. |
| **MACVerify** | https://www.macverify.com/ | Lookup gratuit, > 77k fabricants, API REST possible. |
| **macaddress.io** | https://macaddress.io/ | Lookup + API (clé requise, payant pour usage intensif). |

---

## Bases officielles (téléchargement / référence)

| Ressource | URL | Usage |
|-----------|-----|--------|
| **IEEE MA-L (OUI24)** | http://standards-oui.ieee.org/oui/oui.csv | CSV gratuit. Colonnes : Registry, OUI, Organization. |
| **IEEE MA-M (OUI28)** | http://standards-oui.ieee.org/oui28/mam.csv | Idem pour blocs 28 bits. |
| **IEEE MA-S (OUI36)** | http://standards-oui.ieee.org/oui36/oui36.csv | Idem pour blocs 36 bits. |
| **IEEE IAB** | http://standards-oui.ieee.org/iab/iab.csv | Individual Address Blocks. |
| **IEEE RA** | https://regauth.standards.ieee.org/standards-ra-web/pub/view.html#registries | Portail officiel des registres OUI. |
| **IANA OUI** | https://www.iana.org/assignments/ethernet-numbers/ethernet-numbers.xhtml | Référence IANA. |

Pour un usage **offline** : télécharger les CSV IEEE et faire un lookup local (ou utiliser **ouilookup**, **oui-data**, **OUImap** sur base Wireshark).

---

## Côté firmware

Le firmware utilise déjà **api.macvendors.com** pour le lookup. On peut ajouter en secours ou en rotation **macvendorlookup.com** ou **maclookup.app** pour améliorer le taux d'identification et limiter la dépendance à un seul fournisseur. Voir `docs/ui_et_eedomus_plan.md` §3.
