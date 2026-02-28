import urllib.request
import json
import re

URL = "https://raw.githubusercontent.com/silverwind/oui-data/master/index.json"
OUTPUT_FILE = "src/progmem_vendors.h"

print("Downloading JSON database from silverwind/oui-data...")
req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
response = urllib.request.urlopen(req)
data = json.loads(response.read().decode('utf-8'))

print("Parsing the database and resolving to 24-bit integers...")
vendors = []
added_prefixes = set()

for prefix, company in data.items():
    clean_prefix = prefix.replace(":", "").replace("-", "").upper()
    p = clean_prefix[0:6]
    if len(p) == 6:
        try:
            mac_int = int(p, 16)
            if mac_int not in added_prefixes:
                safe_company = company.replace('"', '\\"').replace("\n", "").replace("\\", "").strip()
                if len(safe_company) > 30:
                    safe_company = safe_company[:27] + "..."
                    
                vendors.append((mac_int, safe_company))
                added_prefixes.add(mac_int)
        except ValueError:
            pass

# Sort vendors by MAC integer value for binary search
vendors.sort(key=lambda x: x[0])

print(f"Generating C++ Header file with {len(vendors)} unique OUI entries...")

header_content = """#ifndef PROGMEM_VENDORS_H
#define PROGMEM_VENDORS_H

#include <Arduino.h>

struct OuiEntry {
    uint32_t prefix;
    const char* vendor;
};

// Sorted array of OUI prefixes for binary search
const OuiEntry oui_table[] PROGMEM = {
"""

for mac, company in vendors:
    header_content += f'    {{0x{mac:06X}, "{company}"}},\n'

header_content += f"""}};

const size_t OUI_TABLE_SIZE = {len(vendors)};

const char* getVendorFromPROGMEM(uint32_t targetPrefix) {{
    int left = 0;
    int right = OUI_TABLE_SIZE - 1;

    while (left <= right) {{
        int mid = left + (right - left) / 2;
        // Read uint32_t from PROGMEM correctly for ESP32
        uint32_t midPrefix = oui_table[mid].prefix;
        
        if (midPrefix == targetPrefix) {{
            return oui_table[mid].vendor;
        }}
        if (midPrefix < targetPrefix) {{
            left = mid + 1;
        }} else {{
            right = mid - 1;
        }}
    }}
    return nullptr;
}}

#endif // PROGMEM_VENDORS_H
"""

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write(header_content)

print(f"Done! Created {OUTPUT_FILE} optimized for PROGMEM Binary Search.")
