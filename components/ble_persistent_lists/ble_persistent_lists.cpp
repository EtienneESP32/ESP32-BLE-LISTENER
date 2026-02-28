#include "ble_persistent_lists.h"
#include "esphome/core/log.h"
#include <algorithm>
#include <nvs.h>
#include <sstream>
#include <vector>

namespace esphome {
namespace ble_persistent_lists {

static const char *const TAG = "ble_lists";
static const char *const NVS_NS = "ble_intrusion";
static const char *const KEY_WL = "wl";
static const char *const KEY_BL = "bl";

std::string BlePersistentListsComponent::normalize_mac(const std::string &mac) {
  std::string out;
  out.reserve(mac.size());
  for (char c : mac) {
    if (c == ':' || c == '-' || (c >= '0' && c <= '9') ||
        (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f'))
      out += (char)(c >= 'a' && c <= 'f' ? c - 32 : c);
  }
  if (out.size() == 12) {
    std::string formatted;
    for (size_t i = 0; i < 12; i += 2) {
      if (i)
        formatted += ':';
      formatted += out[i];
      formatted += out[i + 1];
    }
    return formatted;
  }
  return mac;
}

std::string
BlePersistentListsComponent::entry_mac_only(const std::string &entry) {
  size_t p = entry.find('|');
  if (p == std::string::npos)
    return entry;
  std::string mac = entry.substr(0, p);
  // Remove trailing spaces
  while (!mac.empty() && mac.back() == ' ') {
    mac.pop_back();
  }
  return mac;
}

bool BlePersistentListsComponent::list_contains(const std::string &list_csv,
                                                const std::string &mac) {
  std::string n = normalize_mac(mac);
  if (n.empty())
    return false;
  std::istringstream iss(list_csv);
  std::string item;
  while (std::getline(iss, item, ',')) {
    if (normalize_mac(entry_mac_only(item)) == n)
      return true;
  }
  return false;
}

void BlePersistentListsComponent::list_add(std::string &list_csv,
                                           const std::string &mac,
                                           const std::string &suffix) {
  std::string n = normalize_mac(mac);
  if (n.empty())
    return;
  if (list_contains(list_csv, n))
    return;
  std::string entry = n;
  if (!suffix.empty()) {
    entry += '|';
    for (char c : suffix) {
      if (c != ',' && c != '|')
        entry += c;
    }
  }
  list_csv = entry + (list_csv.empty() ? "" : "," + list_csv);
  if (list_csv.size() > MAX_LIST_BYTES)
    list_csv.resize(MAX_LIST_BYTES);
}

void BlePersistentListsComponent::list_remove(std::string &list_csv,
                                              const std::string &mac) {
  std::string n = normalize_mac(mac);
  if (n.empty())
    return;
  std::string new_list;
  std::istringstream iss(list_csv);
  std::string item;
  bool first = true;
  while (std::getline(iss, item, ',')) {
    if (normalize_mac(entry_mac_only(item)) == n)
      continue;
    if (!first)
      new_list += ',';
    new_list += item;
    first = false;
  }
  list_csv = new_list;
}

void BlePersistentListsComponent::list_set_suffix(std::string &list_csv,
                                                  const std::string &mac,
                                                  const std::string &suffix) {
  std::string n = normalize_mac(mac);
  if (n.empty())
    return;
  std::string new_list;
  std::istringstream iss(list_csv);
  std::string item;
  bool first = true;
  while (std::getline(iss, item, ',')) {
    if (normalize_mac(entry_mac_only(item)) == n) {
      if (!first)
        new_list += ',';
      new_list += n;
      if (!suffix.empty()) {
        new_list += '|';
        for (char c : suffix) {
          if (c != ',' && c != '|')
            new_list += c;
        }
      }
      first = false;
      continue;
    }
    if (!first)
      new_list += ',';
    new_list += item;
    first = false;
  }
  list_csv = new_list;
}

void BlePersistentListsComponent::load_all() {
  nvs_handle_t h;
  if (nvs_open(NVS_NS, NVS_READONLY, &h) != ESP_OK) {
    ESP_LOGD(TAG, "NVS open read failed");
    return;
  }
  size_t len = 0;
  if (nvs_get_str(h, KEY_WL, nullptr, &len) == ESP_OK && len > 0) {
    std::vector<char> buf(len);
    if (nvs_get_str(h, KEY_WL, buf.data(), &len) == ESP_OK)
      whitelist_.assign(buf.data());
  }
  len = 0;
  if (nvs_get_str(h, KEY_BL, nullptr, &len) == ESP_OK && len > 0) {
    std::vector<char> buf(len);
    if (nvs_get_str(h, KEY_BL, buf.data(), &len) == ESP_OK)
      blacklist_.assign(buf.data());
  }
  nvs_close(h);
  ESP_LOGD(TAG, "Loaded whitelist %u bytes, blacklist %u bytes",
           (unsigned)whitelist_.size(), (unsigned)blacklist_.size());
  unsigned n_wl = 0;
  for (char c : whitelist_)
    if (c == ',')
      n_wl++;
  if (!whitelist_.empty())
    n_wl++;
  ESP_LOGI(TAG,
           "Whitelist chargee: %u MAC(s) (NVS conservee au flash, ne pas "
           "effacer la flash)",
           n_wl);
}

void BlePersistentListsComponent::save_whitelist() {
  nvs_handle_t h;
  if (nvs_open(NVS_NS, NVS_READWRITE, &h) != ESP_OK) {
    ESP_LOGD(TAG, "NVS open write failed");
    return;
  }
  esp_err_t err = nvs_set_str(h, KEY_WL, whitelist_.c_str());
  if (err == ESP_OK)
    nvs_commit(h);
  nvs_close(h);
}

void BlePersistentListsComponent::save_blacklist() {
  nvs_handle_t h;
  if (nvs_open(NVS_NS, NVS_READWRITE, &h) != ESP_OK) {
    ESP_LOGD(TAG, "NVS open write failed");
    return;
  }
  esp_err_t err = nvs_set_str(h, KEY_BL, blacklist_.c_str());
  if (err == ESP_OK)
    nvs_commit(h);
  nvs_close(h);
}

void BlePersistentListsComponent::setup() { load_all(); }

bool BlePersistentListsComponent::is_in_whitelist(const std::string &mac) {
  return list_contains(whitelist_, mac);
}

std::string BlePersistentListsComponent::get_whitelist_display() const {
  std::string out;
  std::istringstream iss(whitelist_);
  std::string item;
  while (std::getline(iss, item, ',')) {
    if (item.empty())
      continue;
    if (!out.empty())
      out += '\n';
    size_t p = item.find('|');
    if (p == std::string::npos) {
      out += item;
    } else {
      out += item.substr(0, p);
      out += " | ";
      out += item.substr(p + 1);
    }
  }
  return out.empty() ? "-" : out;
}

std::string
BlePersistentListsComponent::get_whitelist_line(int index_0based) const {
  if (index_0based < 0)
    return "";
  std::istringstream iss(whitelist_);
  std::string item;
  int idx = 0;
  while (std::getline(iss, item, ',')) {
    if (item.empty())
      continue;
    if (idx == index_0based) {
      size_t p = item.find('|');
      if (p == std::string::npos)
        return item;
      return item.substr(0, p) + " | " + item.substr(p + 1);
    }
    idx++;
  }
  return "";
}

std::string
BlePersistentListsComponent::get_whitelist_mac(int index_0based) const {
  if (index_0based < 0)
    return "";
  std::istringstream iss(whitelist_);
  std::string item;
  int idx = 0;
  while (std::getline(iss, item, ',')) {
    if (item.empty())
      continue;
    if (idx == index_0based)
      return entry_mac_only(item);
    idx++;
  }
  return "";
}

std::string
BlePersistentListsComponent::get_whitelist_label(int index_0based) const {
  if (index_0based < 0)
    return "";
  std::istringstream iss(whitelist_);
  std::string item;
  int idx = 0;
  while (std::getline(iss, item, ',')) {
    if (item.empty())
      continue;
    if (idx == index_0based) {
      size_t p = item.find('|');
      if (p == std::string::npos)
        return "";
      return item.substr(p + 1);
    }
    idx++;
  }
  return "";
}

void BlePersistentListsComponent::add_to_whitelist(const std::string &mac,
                                                   const std::string &label) {
  list_add(whitelist_, mac, label);
  save_whitelist();
}

void BlePersistentListsComponent::remove_from_whitelist(
    const std::string &mac) {
  list_remove(whitelist_, mac);
  save_whitelist();
}

void BlePersistentListsComponent::clear_whitelist() {
  whitelist_.clear();
  save_whitelist();
}

void BlePersistentListsComponent::set_whitelist_label(
    const std::string &mac, const std::string &label) {
  list_set_suffix(whitelist_, mac, label);
  save_whitelist();
}

bool BlePersistentListsComponent::is_in_blacklist(const std::string &mac) {
  return list_contains(blacklist_, mac);
}

void BlePersistentListsComponent::add_to_blacklist(const std::string &mac,
                                                   const std::string &info) {
  list_add(blacklist_, mac, info);
  save_blacklist();
}

void BlePersistentListsComponent::remove_from_blacklist(
    const std::string &mac) {
  list_remove(blacklist_, mac);
  save_blacklist();
}

} // namespace ble_persistent_lists
} // namespace esphome

void esphome::ble_persistent_lists::BlePersistentListsComponent::
    add_recent_mac_no_duplicate(const std::string &mac, const std::string &name,
                                const std::string &manuf_data,
                                const std::string &uuids) {
  std::string n = normalize_mac(mac);
  if (n.empty())
    return;

  auto it = std::find_if(recent_macs_.begin(), recent_macs_.end(),
                         [&](const std::string &entry) {
                           return normalize_mac(entry_mac_only(entry)) == n;
                         });

  std::string merge_name = name;
  std::string merge_manuf = manuf_data;
  std::string merge_uuids = uuids;

  std::string analyzed_brand = "";

  if (uuids.find("180D") != std::string::npos)
    analyzed_brand = "[HR Sensor]";
  else if (uuids.find("181A") != std::string::npos)
    analyzed_brand = "[Env Sensor]";
  else if (uuids.find("FE9F") != std::string::npos ||
           uuids.find("FD69") != std::string::npos)
    analyzed_brand = "[Google/Android]";
  else if (uuids.find("FEA0") != std::string::npos)
    analyzed_brand = "[Google Cast/Nest]";

  if (!manuf_data.empty()) {
    std::string cid = "";
    std::string payload = "";
    size_t colon_pos = manuf_data.find(':');
    if (colon_pos != std::string::npos) {
      cid = manuf_data.substr(0, colon_pos);
      payload = manuf_data.substr(colon_pos + 1);
    } else {
      cid = manuf_data;
    }

    if (cid.length() >= 2 && cid.substr(0, 2) == "0x")
      cid = cid.substr(2);
    for (char &c : cid)
      c = toupper(c);

    if (cid == "004C") {
      analyzed_brand = "[Apple";
      if (payload.length() >= 2) {
        std::string type = payload.substr(0, 2);
        if (type == "02" || type == "15")
          analyzed_brand += " iBeacon]";
        else if (type == "10")
          analyzed_brand += " Nearby/AirDrop]";
        else if (type == "12")
          analyzed_brand += " Find My]";
        else if (type == "07")
          analyzed_brand += " AirPods]";
        else
          analyzed_brand += "]";
      } else {
        analyzed_brand += "]";
      }
    } else if (cid == "0075")
      analyzed_brand = "[Samsung]";
    else if (cid == "0006")
      analyzed_brand = "[Microsoft Windows]";
    else if (cid == "00E0" || cid == "00D0")
      analyzed_brand = "[Google]";
    else if (cid == "0157")
      analyzed_brand = "[Xiaomi]";
    else if (cid == "0952")
      analyzed_brand = "[Tile]";
    else if (cid == "0059")
      analyzed_brand = "[Nordic Semi]";

    if (analyzed_brand.empty() && !cid.empty()) {
      analyzed_brand = "[Manuf: " + cid + "]";
    }
  }

  if (it != recent_macs_.end()) {
    std::string old_entry = *it;
    size_t p1 = old_entry.find(" | ");
    size_t p2 = p1 != std::string::npos ? old_entry.find(" | ", p1 + 3)
                                        : std::string::npos;
    size_t p3 = p2 != std::string::npos ? old_entry.find(" | ", p2 + 3)
                                        : std::string::npos;

    std::string old_name = (p1 != std::string::npos && p2 != std::string::npos)
                               ? old_entry.substr(p1 + 3, p2 - p1 - 3)
                               : "";
    std::string old_manuf = (p2 != std::string::npos && p3 != std::string::npos)
                                ? old_entry.substr(p2 + 3, p3 - p2 - 3)
                                : "";
    std::string old_uuids =
        (p3 != std::string::npos) ? old_entry.substr(p3 + 3) : "";

    if (old_name.empty() && p1 != std::string::npos && p2 == std::string::npos)
      old_name = old_entry.substr(p1 + 3);

    if (merge_name.empty() && !old_name.empty() && old_name != "(Inconnu)")
      merge_name = old_name;

    if (!analyzed_brand.empty()) {
      merge_manuf = analyzed_brand;
    } else if (merge_manuf.empty() && !old_manuf.empty() &&
               old_manuf != "(Pas de Manuf)") {
      merge_manuf = old_manuf;
    }

    if (merge_uuids.empty() && !old_uuids.empty() &&
        old_uuids != "(Pas d'UUID)")
      merge_uuids = old_uuids;
  } else {
    if (!analyzed_brand.empty()) {
      merge_manuf = analyzed_brand;
    }
  }

  std::string d_name = merge_name.empty() ? "(Inconnu)" : merge_name;
  std::string d_manuf = merge_manuf.empty() ? "(Pas de Manuf)" : merge_manuf;
  std::string d_uuids = merge_uuids.empty() ? "(Pas d'UUID)" : merge_uuids;

  if (d_uuids.length() > 15 && d_uuids != "(Pas d'UUID)") {
    d_uuids = d_uuids.substr(0, 12) + "...";
  }

  std::string full_entry =
      n + " | " + d_name + " | " + d_manuf + " | " + d_uuids;

  if (it != recent_macs_.end()) {
    *it = full_entry;
    return;
  }

  recent_macs_.push_back(full_entry);

  if (recent_macs_.size() > 50) {
    recent_macs_.erase(recent_macs_.begin());
  }
}

std::string
esphome::ble_persistent_lists::BlePersistentListsComponent::get_recent_mac(
    int index_0based) const {
  if (index_0based >= 0 && index_0based < recent_macs_.size()) {
    return recent_macs_[index_0based];
  }
  return "";
}
