#pragma once

#include "esphome/core/component.h"
#include <string>

namespace esphome {
namespace ble_persistent_lists {

static const size_t MAX_LIST_BYTES = 3800;

class BlePersistentListsComponent : public Component {
 public:
  void setup() override;
  float get_setup_priority() const override { return setup_priority::DATA; }

  bool is_in_whitelist(const std::string &mac);
  void add_to_whitelist(const std::string &mac);
  void remove_from_whitelist(const std::string &mac);
  std::string get_whitelist_str() const { return whitelist_; }

  bool is_in_blacklist(const std::string &mac);
  void add_to_blacklist(const std::string &mac);
  void remove_from_blacklist(const std::string &mac);
  std::string get_blacklist_str() const { return blacklist_; }

 private:
  void load_all();
  void save_whitelist();
  void save_blacklist();
  static std::string normalize_mac(const std::string &mac);
  static bool list_contains(const std::string &list_csv, const std::string &mac);
  static void list_add(std::string &list_csv, const std::string &mac);
  static void list_remove(std::string &list_csv, const std::string &mac);

  std::string whitelist_;
  std::string blacklist_;
};

}  // namespace ble_persistent_lists
}  // namespace esphome
