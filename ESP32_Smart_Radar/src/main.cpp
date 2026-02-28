#include <Arduino.h>
#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <WiFi.h>
#include <time.h>

// ------------------------------------------------------------------
// CONFIGURATION (To be changed by user)
// ------------------------------------------------------------------
const char *WIFI_SSID = "XXX";
const char *WIFI_PASSWORD = "XXX";

// Eedomus Configuration
const char *EEDOMUS_IP = "XXX"; // Replace with your Eedomus IP
const char *EEDOMUS_API_USER = "XXX";
const char *EEDOMUS_API_SECRET = "XXX";
const char *EEDOMUS_PERIPH_ID = "0"; // Replace with your Eedomus Peripheral ID

const char *FIRMWARE_VERSION = "v1.3.5";

// NTP Configuration
const char *NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 3600;     // UTC+1 (France)
const int DAYLIGHT_OFFSET_SEC = 3600; // +1h summer

// Timing configurable parameters
const int SCAN_TIME = 10; // Seconds to scan BLE
const int PAUSE_TIME = 2; // Pause between scans to give WiFi room to breathe

// Static IP Configuration
IPAddress local_IP(192, 168, 1, 225);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);   // Optional
IPAddress secondaryDNS(8, 8, 4, 4); // Optional

// ------------------------------------------------------------------
// GLOBAL VARIABLES
// ------------------------------------------------------------------
AsyncWebServer server(80);
NimBLEScan *pBLEScan;
Preferences preferences;

#include "progmem_vendors.h"

// Store recently detected devices (short memory for the UI)
struct BleDeviceData {
  String address;
  String name;
  int rssi;
  String vendor;
  String addressType;
  int txPower;
  String serviceUUIDs;
  String manufacturerData;
  uint16_t appearance;
  String gattName;     // Name read via GATT connection
  int8_t batteryLevel; // Battery % read via GATT (-1 = unknown)
  bool gattAttempted;  // Avoid retrying indefinitely
  unsigned long lastSeen;
};
std::vector<BleDeviceData> detectedDevices;

// Store known whitelist internally
std::vector<String> whitelist;

// Keep track of alert cooldown
unsigned long lastAlertTime = 0;
const unsigned long ALERT_COOLDOWN = 60000; // 1 min between identical alerts

// Flags
bool scanInProgress = false;
unsigned long scanStartTime = 0;
bool surveillanceActive = false;
std::vector<String> alertedMacs;

// LastSeen timestamps: mac -> unix timestamp
std::map<String, time_t> lastSeenMap;

// Whitelist enriched metadata: mac -> {name, vendor}
struct WlMeta {
  String name;
  String vendor;
  String mfgData;
};
std::map<String, WlMeta> wlMetaMap;

// GATT FreeRTOS task
QueueHandle_t gattQueue;
struct GattTask {
  int devIndex;
};

bool gattTaskRunning = false;
bool lastSeenDirty = false; // NVS flush only when map changed

// ------------------------------------------------------------------
// FORWARD DECLARATIONS
// ------------------------------------------------------------------
void saveLastSeen(const String &mac);
void loadLastSeen();
void saveWlMeta();
void loadWlMeta();

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

void loadWhitelist() {
  preferences.begin("radar", false);
  String wlstr = preferences.getString("whitelist", "[]");
  surveillanceActive = preferences.getBool("surveillance", false);
  preferences.end();

  DynamicJsonDocument doc(2048);
  deserializeJson(doc, wlstr);
  JsonArray arr = doc.as<JsonArray>();

  whitelist.clear();
  for (JsonVariant v : arr) {
    whitelist.push_back(v.as<String>());
  }
}

void saveWhitelist() {
  DynamicJsonDocument doc(2048);
  JsonArray arr = doc.to<JsonArray>();
  for (String m : whitelist) {
    arr.add(m);
  }
  String output;
  serializeJson(doc, output);
  preferences.begin("radar", false);
  preferences.putString("whitelist", output);
  preferences.end();
}

void saveLastSeen(const String &mac) {
  time_t now;
  time(&now);
  if (now < 100000)
    return; // NTP not synced
  lastSeenMap[mac] = now;
  DynamicJsonDocument doc(4096);
  JsonObject obj = doc.to<JsonObject>();
  for (auto &kv : lastSeenMap) {
    obj[kv.first] = (long)kv.second;
  }
  String output;
  serializeJson(doc, output);
  preferences.begin("radar", false);
  preferences.putString("lastseen", output);
  preferences.end();
}

void loadLastSeen() {
  preferences.begin("radar", false);
  String lsStr = preferences.getString("lastseen", "{}");
  preferences.end();
  DynamicJsonDocument doc(4096);
  deserializeJson(doc, lsStr);
  JsonObject obj = doc.as<JsonObject>();
  for (JsonPair kv : obj) {
    lastSeenMap[String(kv.key().c_str())] = (time_t)kv.value().as<long>();
  }
}

void saveWlMeta() {
  DynamicJsonDocument doc(4096);
  JsonObject root = doc.to<JsonObject>();
  for (auto &kv : wlMetaMap) {
    JsonObject entry = root.createNestedObject(kv.first);
    entry["n"] = kv.second.name;
    entry["v"] = kv.second.vendor;
    entry["m"] = kv.second.mfgData;
  }
  String out;
  serializeJson(doc, out);
  preferences.begin("radar", false);
  preferences.putString("wlmeta", out);
  preferences.end();
}

void loadWlMeta() {
  preferences.begin("radar", false);
  String s = preferences.getString("wlmeta", "{}");
  preferences.end();
  DynamicJsonDocument doc(4096);
  deserializeJson(doc, s);
  JsonObject root = doc.as<JsonObject>();
  for (JsonPair kv : root) {
    WlMeta m;
    m.name = kv.value()["n"].as<String>();
    m.vendor = kv.value()["v"].as<String>();
    m.mfgData = kv.value()["m"].as<String>();
    wlMetaMap[String(kv.key().c_str())] = m;
  }
}

void saveSurveillance() {
  preferences.begin("radar", false);
  preferences.putBool("surveillance", surveillanceActive);
  preferences.end();
}

bool isAlerted(const String &mac) {
  for (const String &m : alertedMacs) {
    if (m == mac)
      return true;
  }
  return false;
}

bool isWhitelisted(String mac) {
  for (String w : whitelist) {
    if (w.equalsIgnoreCase(mac))
      return true;
  }
  return false;
}

void notifyEedomus(String mac) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String("http://") + EEDOMUS_IP +
                 "/api/set?action=periph.value&periph_id=" + EEDOMUS_PERIPH_ID +
                 "&value=" + mac + "&api_user=" + EEDOMUS_API_USER +
                 "&api_secret=" + EEDOMUS_API_SECRET;
    http.begin(url);
    int httpCode = http.GET();
    Serial.printf("Eedomus notification sent for %s, response code: %d\n",
                  mac.c_str(), httpCode);
    http.end();
  } else {
    Serial.println("Cannot notify Eedomus, WiFi disconnected.");
  }
}

// ------------------------------------------------------------------
// BLE CALLBACKS
// ------------------------------------------------------------------
class MyAdvertisedDeviceCallbacks : public NimBLEAdvertisedDeviceCallbacks {
  void onResult(NimBLEAdvertisedDevice *advertisedDevice) {
    String address = String(advertisedDevice->getAddress().toString().c_str());
    address.toUpperCase();
    String name = "Unknown";
    if (advertisedDevice->haveName()) {
      name = String(advertisedDevice->getName().c_str());
    }
    int rssi = advertisedDevice->getRSSI();

    // -- Advanced Metadata Extraction --

    // 1. Address Type
    String addrType = "Unknown";
    switch (advertisedDevice->getAddressType()) {
    case BLE_ADDR_PUBLIC:
      addrType = "Public (Fixe)";
      break;
    case BLE_ADDR_RANDOM:
      addrType = "Static Random";
      break;
    case BLE_ADDR_PUBLIC_ID:
      addrType = "Public ID";
      break;
    case BLE_ADDR_RANDOM_ID:
      addrType = "Random Resolvable (Smartphone)";
      break;
    }

    // 2. TX Power
    int txPower =
        advertisedDevice->haveTXPower() ? advertisedDevice->getTXPower() : -999;

    // 3. Service UUIDs
    String services = "";
    if (advertisedDevice->haveServiceUUID()) {
      for (int i = 0; i < advertisedDevice->getServiceUUIDCount(); i++) {
        NimBLEUUID uuid = advertisedDevice->getServiceUUID(i);
        services += String(uuid.toString().c_str()) + ", ";
      }
    }

    // 4. Manufacturer data snippet
    String mfgData = "";
    if (advertisedDevice->haveManufacturerData()) {
      std::string rawStr = advertisedDevice->getManufacturerData();
      char buf[4];
      for (int i = 0; i < rawStr.length(); i++) {
        sprintf(buf, "%02X", (uint8_t)rawStr[i]);
        mfgData += String(buf);
      }
    }

    // 5. Appearance
    uint16_t appearance = advertisedDevice->haveAppearance()
                              ? advertisedDevice->getAppearance()
                              : 0;

    // Try to extract vendor from local PROGMEM database (Binary Search)
    String vendor = "N/A";

    // Extract the first 3 octets of MAC address safely
    if (address.length() >= 8) {
      String cleanPrefix = address.substring(0, 8); // Format is XX:XX:XX
      cleanPrefix.replace(":", "");                 // Make it XXXXXX
      if (cleanPrefix.length() == 6) {
        uint32_t prefix_int = strtoul(cleanPrefix.c_str(), NULL, 16);
        const char *foundVendor = getVendorFromPROGMEM(prefix_int);
        if (foundVendor != nullptr) {
          vendor = String(foundVendor);
          // Si la puce n'a pas diffusé son propre nom, on met le constructeur à
          // la place
          if (name == "Unknown") {
            name = vendor;
          }
        }
      }
    }

    // Update detected devices list
    bool found = false;
    for (auto &dev : detectedDevices) {
      if (dev.address == address) {
        if (name != "Unknown")
          dev.name = name;
        dev.rssi = rssi;
        dev.vendor = vendor;
        dev.addressType = addrType;
        if (txPower != -999)
          dev.txPower = txPower;
        if (services.length() > 0)
          dev.serviceUUIDs = services;
        if (mfgData.length() > 0)
          dev.manufacturerData = mfgData;
        dev.appearance = appearance;

        dev.lastSeen = millis();
        // In-memory only — NVS flush happens once per scan cycle in loop()
        time_t now;
        time(&now);
        if (now > 100000) {
          lastSeenMap[dev.address] = now;
          lastSeenDirty = true;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      if (detectedDevices.size() > 50) {
        detectedDevices.erase(detectedDevices.begin());
      }
      detectedDevices.push_back({address, name, rssi, vendor, addrType, txPower,
                                 services, mfgData, appearance, "", -1, false,
                                 millis()});
    }

    // Intrusion check — uniquement si surveillance active
    if (surveillanceActive && !isWhitelisted(address)) {
      if (rssi > -90 && !isAlerted(address)) {
        alertedMacs.push_back(address);
        Serial.printf("🚨 INTRUS: %s (%s) RSSI: %d\n", address.c_str(),
                      name.c_str(), rssi);
        if (millis() - lastAlertTime > ALERT_COOLDOWN) {
          lastAlertTime = millis();
          notifyEedomus(address);
        }
      }
    }
  }
};

// ------------------------------------------------------------------
// GATT TASK (FreeRTOS) — non-blocking
// ------------------------------------------------------------------
void tryReadGattInfo(BleDeviceData &dev) {
  if (dev.gattAttempted)
    return;
  dev.gattAttempted = true;
  NimBLEAddress bleAddr(dev.address.c_str());
  NimBLEClient *pClient = NimBLEDevice::createClient();
  pClient->setConnectionParams(12, 12, 0, 51);
  pClient->setConnectTimeout(2);
  Serial.printf("[GATT] Connecting to %s...\n", dev.address.c_str());
  if (!pClient->connect(bleAddr)) {
    NimBLEDevice::deleteClient(pClient);
    return;
  }
  NimBLERemoteService *pSvcGAP =
      pClient->getService(NimBLEUUID((uint16_t)0x1800));
  if (pSvcGAP) {
    NimBLERemoteCharacteristic *pChar =
        pSvcGAP->getCharacteristic(NimBLEUUID((uint16_t)0x2A00));
    if (pChar && pChar->canRead()) {
      std::string val = pChar->readValue();
      if (!val.empty()) {
        dev.gattName = String(val.c_str());
      }
    }
  }
  NimBLERemoteService *pSvcBat =
      pClient->getService(NimBLEUUID((uint16_t)0x180F));
  if (pSvcBat) {
    NimBLERemoteCharacteristic *pChar =
        pSvcBat->getCharacteristic(NimBLEUUID((uint16_t)0x2A19));
    if (pChar && pChar->canRead()) {
      std::string val = pChar->readValue();
      if (!val.empty()) {
        dev.batteryLevel = (int8_t)(uint8_t)val[0];
      }
    }
  }
  pClient->disconnect();
  NimBLEDevice::deleteClient(pClient);
}

void gattWorkerTask(void *param) {
  GattTask task;
  while (true) {
    if (xQueueReceive(gattQueue, &task, portMAX_DELAY) == pdTRUE) {
      if (task.devIndex >= 0 && task.devIndex < (int)detectedDevices.size()) {
        tryReadGattInfo(detectedDevices[task.devIndex]);
      }
      gattTaskRunning = false;
    }
  }
}

// ------------------------------------------------------------------
// SETUP
// ------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Init File System
  if (!LittleFS.begin(true)) {
    Serial.println("An Error has occurred while mounting LittleFS");
    return;
  }

  // Load data
  loadWhitelist();
  loadWlMeta();

  // Init WiFi
  Serial.printf("Connecting to %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);

  // Configuration IP Fixe
  if (!WiFi.config(local_IP, gateway, subnet)) {
    Serial.println("STA Failed to configure");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Don't block forever, proceed if it takes too long
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" CONNECTED");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    // NTP time sync — wait up to 10s
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    Serial.println("[NTP] Syncing time...");
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 10000)) {
      Serial.printf("[NTP] ✅ %02d:%02d:%02d\n", timeinfo.tm_hour,
                    timeinfo.tm_min, timeinfo.tm_sec);
    } else {
      Serial.println("[NTP] ⚠️ Sync timeout — timestamps will be unavailable");
    }
  } else {
    Serial.println(" FAILED. Check credentials.");
  }
  // Always load lastSeen (even without WiFi, reload from NVS)
  loadLastSeen();

  // Init BLE
  NimBLEDevice::init("");
  pBLEScan = NimBLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks(),
                                         true);
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(97);
  pBLEScan->setWindow(37);

  // Create GATT worker task on Core 0 (WiFi runs on Core 0, but this is async)
  gattQueue = xQueueCreate(5, sizeof(GattTask));
  xTaskCreatePinnedToCore(gattWorkerTask, "GATTWorker", 8192, NULL, 1, NULL, 0);

  // Setup Web Server Routes
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    AsyncWebServerResponse *response =
        request->beginResponse(LittleFS, "/index.html", "text/html");
    response->addHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response->addHeader("Pragma", "no-cache");
    response->addHeader("Expires", "0");
    request->send(response);
  });
  server.on("/style_v11.css", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/style_v11.css", "text/css");
  });
  server.on("/script_v11.js", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/script_v11.js", "text/javascript");
  });

  server.on("/vendors.json", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/vendors.json", "application/json");
  });

  // API: Get active devices
  server.on("/api/devices", HTTP_GET, [](AsyncWebServerRequest *request) {
    DynamicJsonDocument doc(
        16384); // Increased buffer to avoid truncation with many devices
    JsonObject root = doc.to<JsonObject>();
    root["version"] = FIRMWARE_VERSION;
    JsonArray devices = root.createNestedArray("devices");

    for (const auto &dev : detectedDevices) {
      // Don't show old devices
      if (millis() - dev.lastSeen < 60000) {
        JsonObject obj = devices.createNestedObject();
        obj["mac"] = dev.address;
        obj["name"] = dev.name;
        obj["rssi"] = dev.rssi;
        obj["vendor"] = dev.vendor;
        obj["addressType"] = dev.addressType;
        obj["txPower"] = dev.txPower;
        obj["services"] = dev.serviceUUIDs;
        obj["mfgData"] = dev.manufacturerData;
        obj["appearance"] = dev.appearance;
        obj["gattName"] = dev.gattName;
        obj["battery"] = dev.batteryLevel;
        obj["whitelisted"] = isWhitelisted(dev.address);
      }
    }
    String output;
    serializeJson(doc, output);
    request->send(200, "application/json", output);
  });

  // API: Get whitelist with lastSeen + enriched meta
  server.on("/api/whitelist", HTTP_GET, [](AsyncWebServerRequest *request) {
    DynamicJsonDocument doc(4096);
    JsonArray array = doc.to<JsonArray>();
    for (const String &mac : whitelist) {
      JsonObject obj = array.createNestedObject();
      obj["mac"] = mac;
      // Priority 1: live detected data
      bool foundLive = false;
      for (const auto &dev : detectedDevices) {
        if (dev.address == mac) {
          obj["name"] = dev.gattName.length() > 0 ? dev.gattName : dev.name;
          obj["vendor"] = dev.vendor;
          obj["mfgData"] = dev.manufacturerData;
          obj["appearance"] = dev.appearance;
          obj["battery"] = dev.batteryLevel;
          obj["services"] = dev.serviceUUIDs;
          obj["addressType"] = dev.addressType;
          obj["live"] = true;
          foundLive = true;
          break;
        }
      }
      // Priority 2: stored meta from NVS
      if (!foundLive && wlMetaMap.count(mac)) {
        obj["name"] = wlMetaMap[mac].name;
        obj["vendor"] = wlMetaMap[mac].vendor;
        obj["mfgData"] = wlMetaMap[mac].mfgData;
        obj["live"] = false;
      } else if (!foundLive) {
        obj["live"] = false;
      }
      obj["lastSeen"] = lastSeenMap.count(mac) ? (long)lastSeenMap[mac] : 0;
    }
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response);
  });

  // API: Add to whitelist
  server.on(
      "/api/whitelist/add", HTTP_POST, [](AsyncWebServerRequest *request) {
        if (request->hasParam("mac", true)) {
          String mac = request->getParam("mac", true)->value();
          if (!isWhitelisted(mac)) {
            whitelist.push_back(mac);
            saveWhitelist();
            // Save meta from live detected data
            for (const auto &dev : detectedDevices) {
              if (dev.address == mac) {
                WlMeta m;
                m.name = dev.gattName.length() > 0 ? dev.gattName : dev.name;
                m.vendor = dev.vendor;
                m.mfgData = dev.manufacturerData;
                wlMetaMap[mac] = m;
                saveWlMeta();
                break;
              }
            }
            request->send(200, "text/plain", "Added");
          } else {
            request->send(200, "text/plain", "Already in list");
          }
        } else {
          request->send(400, "text/plain", "Missing MAC");
        }
      });

  // API: Remove from whitelist
  server.on("/api/whitelist/remove", HTTP_POST,
            [](AsyncWebServerRequest *request) {
              if (request->hasParam("mac", true)) {
                String mac = request->getParam("mac", true)->value();
                auto it = std::find(whitelist.begin(), whitelist.end(), mac);
                if (it != whitelist.end()) {
                  whitelist.erase(it);
                  saveWhitelist();
                  request->send(200, "text/plain", "Removed");
                } else {
                  request->send(404, "text/plain", "Not found");
                }
              } else {
                request->send(400, "text/plain", "Missing MAC");
              }
            });

  // API: Add ALL currently detected (non-whitelisted) devices
  server.on("/api/whitelist/add-all", HTTP_POST,
            [](AsyncWebServerRequest *request) {
              int added = 0;
              for (const auto &dev : detectedDevices) {
                if (!isWhitelisted(dev.address)) {
                  whitelist.push_back(dev.address);
                  WlMeta m;
                  m.name = dev.gattName.length() > 0 ? dev.gattName : dev.name;
                  m.vendor = dev.vendor;
                  m.mfgData = dev.manufacturerData;
                  wlMetaMap[dev.address] = m;
                  added++;
                }
              }
              if (added > 0) {
                saveWhitelist();
                saveWlMeta();
              }
              request->send(200, "application/json",
                            "{\"added\":" + String(added) + "}");
            });

  // API: Clear entire whitelist + meta + lastSeen
  server.on("/api/whitelist/clear", HTTP_POST,
            [](AsyncWebServerRequest *request) {
              int removed = whitelist.size();
              whitelist.clear();
              wlMetaMap.clear();
              lastSeenMap.clear();
              lastSeenDirty = false;
              saveWhitelist();
              saveWlMeta();
              preferences.begin("radar", false);
              preferences.remove("lastseen");
              preferences.end();
              request->send(200, "application/json",
                            "{\"removed\":" + String(removed) + "}");
            });

  // API: Surveillance state
  server.on("/api/surveillance", HTTP_GET, [](AsyncWebServerRequest *request) {
    String resp =
        String("{\"active\":") + (surveillanceActive ? "true" : "false") + "}";
    request->send(200, "application/json", resp);
  });

  // API: Toggle surveillance
  server.on("/api/surveillance/toggle", HTTP_POST,
            [](AsyncWebServerRequest *request) {
              surveillanceActive = !surveillanceActive;
              if (!surveillanceActive)
                alertedMacs.clear(); // Reset alerts on disarm
              saveSurveillance();
              String resp = String("{\"active\":") +
                            (surveillanceActive ? "true" : "false") + "}";
              request->send(200, "application/json", resp);
            });

  // API: Get alerted MACs
  server.on("/api/alerts", HTTP_GET, [](AsyncWebServerRequest *request) {
    DynamicJsonDocument doc(2048);
    JsonArray arr = doc.to<JsonArray>();
    for (const String &m : alertedMacs)
      arr.add(m);
    String output;
    serializeJson(doc, output);
    request->send(200, "application/json", output);
  });

  server.begin();
  scanStartTime = millis() - SCAN_TIME * 1000; // Trigger immediately
}

// ------------------------------------------------------------------
// LOOP
// ------------------------------------------------------------------
void loop() {
  unsigned long currentMillis = millis();

  // Alternate Scanning and Pausing (to let WiFi work)
  if (!scanInProgress) {
    if (currentMillis - scanStartTime >= (PAUSE_TIME * 1000)) {
      // Start scanning!
      scanInProgress = true;
      NimBLEDevice::getScan()->start(SCAN_TIME, false);
      scanStartTime = currentMillis;
    }
  } else {
    if (currentMillis - scanStartTime >= (SCAN_TIME * 1000)) {
      // Stop scanning
      NimBLEDevice::getScan()->stop();
      scanInProgress = false;
      scanStartTime = currentMillis;

      // GATT client désactivé — le scan actif suffit pour les noms
      // (le client GATT monopolise le radio BLE et dégrade la qualité du scan)

      // Cleanup old devices from memory
      auto i = std::begin(detectedDevices);
      while (i != std::end(detectedDevices)) {
        if (currentMillis - i->lastSeen > 120000) {
          i = detectedDevices.erase(i);
        } else {
          ++i;
        }
      }

      // Batch NVS flush: only if data changed (flag dirty)
      if (lastSeenDirty && !lastSeenMap.empty()) {
        DynamicJsonDocument doc(4096);
        JsonObject obj = doc.to<JsonObject>();
        for (auto &kv : lastSeenMap) {
          obj[kv.first] = (long)kv.second;
        }
        String out;
        serializeJson(doc, out);
        preferences.begin("radar", false);
        preferences.putString("lastseen", out);
        preferences.end();
        lastSeenDirty = false;
      }
    }
  }
}
