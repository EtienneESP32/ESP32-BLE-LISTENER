# -*- coding: utf-8 -*-
"""Génère les blocs UI compacts (1 ligne par entité) pour ble-sniffer.yaml"""
import os
import sys
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(SCRIPT_DIR, "compact_ui_generated.yaml")

def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')

# Inconnu: extrait la n-ième entrée de last_unknown_entries (0-based)
def inconnu_lambda(n):
    return f'std::string m = id(ble_lists).get_recent_mac({n}); return m.empty() ? std::string("") : (m.find("|") != std::string::npos ? m : m + " | (Pas de nom)");'

def wl_num_lambda(idx):
    num = idx + 1
    s = str(num)
    return f'std::string m = id(ble_lists).get_whitelist_mac({idx}); return m.empty() ? std::string("{s}. -") : std::string("{s}");'

def wl_mac_lambda(idx):
    return f'std::string m = id(ble_lists).get_whitelist_mac({idx}); return m.empty() ? std::string("-") : m;'

def wl_nom_lambda(idx):
    return f'return id(ble_lists).get_whitelist_label({idx});'

def wl_nom_setaction(idx):
    return f'std::string mac = id(ble_lists).get_whitelist_mac({idx}); if (!mac.empty()) id(ble_lists).set_whitelist_label(mac, x);'

def btn_wl_lambda(idx):
    return (
        'std::string e = std::string(id(last_10_entries)); size_t pos = 0; std::string mac; '
        f'for (int i = 0; pos <= e.size() && i < {idx+1}; i++) {{ '
        'size_t next = e.find(\'\\\\n\', pos); if (next == std::string::npos) next = e.size(); '
        f'if (i == {idx}) {{ std::string line = e.substr(pos, next - pos); size_t pipe = line.find(\'|\'); '
        'mac = pipe != std::string::npos ? line.substr(0, pipe) : line; } pos = next + 1; } '
        'if (!mac.empty()) { id(ble_lists).add_to_whitelist(mac, ""); }'
    )

def btn_rm_wl_lambda(idx):
    return (
        f'std::string mac = id(ble_lists).get_whitelist_mac({idx}); '
        'if (!mac.empty()) { id(ble_lists).remove_from_whitelist(mac); }'
    )

def q(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

out = []



# WL 01..20: Nom — L'ID affiche la MAC via le titre, set_action édite le nom 
# On supprime WL MAC NUM et le remplace par ça (1 entité pour Nom + MAC)
for i in range(20):
    nn = f"{(i+1):02d}"
    lam = q(wl_nom_lambda(i))
    sa = q(wl_nom_setaction(i))
    # Note: On triche en mettant le prefix "WL XX: " fixe, le nom est éditable. La MAC ne peut pas être dynamique dans "name" d'un text mais on peut au pire le formater
    # Mieux : Le nom "WL XX Nom" + "x Supprimer WL XX". La MAC est lisible car on n'a plus que 2 entités par entrée WL
    out.append(f'  - platform: template\n    name: "WL {nn}"\n    id: wl_nom_{i+1}\n    mode: text\n    min_length: 0\n    max_length: 60\n    update_interval: 10s\n    lambda: "{lam}"\n    set_action:\n      - lambda: "{sa}"')

for i in range(20):
    nn = f"{(i+1):02d}"
    lam_mac = q(wl_mac_lambda(i))
    out.append(f'  - {{ platform: template, name: "MAC WL {nn}", id: text_wl_{i+1}_mac, update_interval: 10s, lambda: "{lam_mac}" }}')

for i in range(20):
    nn = f"{(i+1):02d}"
    lam = q(btn_rm_wl_lambda(i))
    out.append(f'  - {{ platform: template, name: "x Supprimer WL {nn}", id: btn_rm_wl_{i+1}, on_press: [{{ lambda: "{lam}" }}] }}')

with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write("\\n".join(out))
print("Written", OUT_PATH)

# Option --apply : fusionner dans ble-sniffer.yaml
import re

if len(sys.argv) > 1 and sys.argv[1] == "--apply":
    yaml_path = os.path.join(SCRIPT_DIR, "ble-sniffer.yaml")
    with open(yaml_path, "r", encoding="utf-8") as f:
        content = f.read()

# --- Inconnus ---
    inconnus_blocks = []
    for i in range(20):
        nn = f"{(i+1):02d}"
        lam = q(inconnu_lambda(i))
        inconnus_blocks.append(f'  - {{ platform: template, name: "Détection {nn}", id: recent_mac_{i+1}, update_interval: 10s, lambda: "{lam}" }}')

    inconnus_str = "\n".join(inconnus_blocks) + "\n"
    content = re.sub(r'(# --- BEGIN COMPACT UI INCONNUS ---\n).*?(# --- END COMPACT UI INCONNUS ---)',
                     rf'\g<1>{inconnus_str}\g<2>', content, flags=re.DOTALL)

    # --- WL_NOM ---
    wl_nom_blocks = []
    for i in range(20):
        nn = f"{(i+1):02d}"
        lam = q(wl_nom_lambda(i))
        sa = q(wl_nom_setaction(i))
        wl_nom_blocks.append(f'  - platform: template\n    name: "WL {nn} Nom"\n    id: wl_nom_{i+1}\n    mode: text\n    min_length: 0\n    max_length: 60\n    update_interval: 10s\n    lambda: "{lam}"\n    set_action:\n      - lambda: "{sa}"')
    wl_nom_str = "\n".join(wl_nom_blocks) + "\n"
    content = re.sub(r'(# --- BEGIN COMPACT UI WL_NOM ---\n).*?(# --- END COMPACT UI WL_NOM ---)',
                     rf'\g<1>{wl_nom_str}\g<2>', content, flags=re.DOTALL)

    # --- WL MAC NUM (on l\'utilise pour mettre MAC WL) ---
    wl_mac_blocks = []
    for i in range(20):
        nn = f"{(i+1):02d}"
        lam_mac = q(wl_mac_lambda(i))
        wl_mac_blocks.append(f'  - {{ platform: template, name: "WL {nn} MAC", id: text_wl_{i+1}_mac, update_interval: 10s, lambda: "{lam_mac}" }}')
    wl_mac_str = "\n".join(wl_mac_blocks) + "\n"
    content = re.sub(r'(# --- BEGIN COMPACT UI WL_MAC_NUM ---\n).*?(# --- END COMPACT UI WL_MAC_NUM ---)',
                     rf'\g<1>{wl_mac_str}\g<2>', content, flags=re.DOTALL)

    # --- BOUTONS ---
    boutons_blocks = []
    for i in range(20):
        nn = f"{(i+1):02d}"
        lam = q(btn_rm_wl_lambda(i))
        boutons_blocks.append(f'  - {{ platform: template, name: "x Supprimer WL {nn}", id: btn_rm_wl_{i+1}, on_press: [{{ lambda: "{lam}" }}] }}')

    boutons_str = "\n".join(boutons_blocks) + "\n"
    content = re.sub(r'(# --- BEGIN COMPACT UI BUTTONS ---\n).*?(# --- END COMPACT UI BUTTONS ---)',
                     rf'\g<1>{boutons_str}\g<2>', content, flags=re.DOTALL)

    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Applied to", yaml_path)
