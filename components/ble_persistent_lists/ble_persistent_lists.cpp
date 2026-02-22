#include "ble_persistent_lists.h"
#include "esphome/core/log.h"
#include <nvs.h>
#include <algorithm>
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
    if (c == ':' || c == '-' || (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f'))
      out += (char) (c >= 'a' && c <= 'f' ? c - 32 : c);
  }
  if (out.size() == 12) {
    std::string formatted;
    for (size_t i = 0; i < 12; i += 2) {
      if (i) formatted += ':';
      formatted += out[i];
      formatted += out[i + 1];
    }
    return formatted;
  }
  return mac;
}

bool BlePersistentListsComponent::list_contains(const std::string &list_csv, const std::string &mac) {
  std::string n = normalize_mac(mac);
  if (n.empty()) return false;
  std::istringstream iss(list_csv);
  std::string item;
  while (std::getline(iss, item, ',')) {
    std::string ni = normalize_mac(item);
    if (ni == n) return true;
  }
  return false;
}

void BlePersistentListsComponent::list_add(std::string &list_csv, const std::string &mac) {
  std::string n = normalize_mac(mac);
  if (n.empty()) return;
  if (list_contains(list_csv, n)) return;
  if (!list_csv.empty()) list_csv += ',';
  list_csv += n;
  if (list_csv.size() > MAX_LIST_BYTES) list_csv.resize(MAX_LIST_BYTES);
}

void BlePersistentListsComponent::list_remove(std::string &list_csv, const std::string &mac) {
  std::string n = normalize_mac(mac);
  if (n.empty()) return;
  std::string new_list;
  std::istringstream iss(list_csv);
  std::string item;
  bool first = true;
  while (std::getline(iss, item, ',')) {
    if (normalize_mac(item) == n) continue;
    if (!first) new_list += ',';
    new_list += item;
    first = false;
  }
  list_csv = new_list;
}

void BlePersistentListsComponent::load_all() {
  nvs_handle_t h;
  if (nvs_open(NVS_NS, NVS_READONLY, &h) != ESP_OK) {
    ESP_LOGW(TAG, "NVS open read failed");
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
  ESP_LOGD(TAG, "Loaded whitelist %u bytes, blacklist %u bytes", (unsigned) whitelist_.size(), (unsigned) blacklist_.size());
  unsigned n_wl = 0;
  for (char c : whitelist_) if (c == ',') n_wl++;
  if (!whitelist_.empty()) n_wl++;
  ESP_LOGI(TAG, "Whitelist chargee: %u MAC(s) (NVS conservee au flash, ne pas effacer la flash)", n_wl);
}

void BlePersistentListsComponent::save_whitelist() {
  nvs_handle_t h;
  if (nvs_open(NVS_NS, NVS_READWRITE, &h) != ESP_OK) {
    ESP_LOGW(TAG, "NVS open write failed");
    return;
  }
  esp_err_t err = nvs_set_str(h, KEY_WL, whitelist_.c_str());
  if (err == ESP_OK) nvs_commit(h);
  nvs_close(h);
}

void BlePersistentListsComponent::save_blacklist() {
  nvs_handle_t h;
  if (nvs_open(NVS_NS, NVS_READWRITE, &h) != ESP_OK) {
    ESP_LOGW(TAG, "NVS open write failed");
    return;
  }
  esp_err_t err = nvs_set_str(h, KEY_BL, blacklist_.c_str());
  if (err == ESP_OK) nvs_commit(h);
  nvs_close(h);
}

void BlePersistentListsComponent::setup() {
  load_all();
}

bool BlePersistentListsComponent::is_in_whitelist(const std::string &mac) {
  return list_contains(whitelist_, mac);
}

void BlePersistentListsComponent::add_to_whitelist(const std::string &mac) {
  list_add(whitelist_, mac);
  save_whitelist();
}

void BlePersistentListsComponent::remove_from_whitelist(const std::string &mac) {
  list_remove(whitelist_, mac);
  save_whitelist();
}

bool BlePersistentListsComponent::is_in_blacklist(const std::string &mac) {
  return list_contains(blacklist_, mac);
}

void BlePersistentListsComponent::add_to_blacklist(const std::string &mac) {
  list_add(blacklist_, mac);
  save_blacklist();
}

void BlePersistentListsComponent::remove_from_blacklist(const std::string &mac) {
  list_remove(blacklist_, mac);
  save_blacklist();
}

}  // namespace ble_persistent_lists
}  // namespace esphome
