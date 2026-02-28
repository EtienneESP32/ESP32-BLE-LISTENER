import urllib.request
import json
import re

URL = "https://raw.githubusercontent.com/silverwind/oui-data/master/index.json"
OUTPUT_FILE = "data/vendors.json"

TARGET_BRANDS = [
    "Apple", "Samsung", "Sony", "Garmin", "Xiaomi", "Huawei",
    "Oppo", "Vivo", "OnePlus", "Motorola", "Lenovo", "Fitbit",
    "Nokia", "LG Electronics", "HTC", "Google", "Microsoft", "Intel", "Asus",
    "Polar", "Suunto", "Withings", "Bose", "Sennheiser", "Jabra", "Coros",
    "Nintendo", "Sony Interactive"
]

print("Downloading JSON database (this may take a moment)...")
req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
response = urllib.request.urlopen(req)
data = json.loads(response.read().decode('utf-8'))

print("Parsing the database...")
vendors = {}
count = 0

for prefix, company in data.items():
    # Only keep the major ones
    for brand in TARGET_BRANDS:
        if brand.lower() in company.lower():
            p = prefix[0:6]
            if len(p) == 6:
                formatted_prefix = f"{p[0:2]}:{p[2:4]}:{p[4:6]}".upper()
                vendors[formatted_prefix] = brand
                count += 1
                break

print(f"Found {count} prefixes matching the targeted brands.")
print(f"Saving to {OUTPUT_FILE}...")

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(vendors, f, separators=(',', ':'))

print("Done! The vendors.json file is ready.")
