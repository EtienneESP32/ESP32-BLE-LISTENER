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
  void add_to_whitelist(const std::string &mac, const std::string &label = "");
  void remove_from_whitelist(const std::string &mac);
  void clear_whitelist();
  void set_whitelist_label(const std::string &mac, const std::string &label);
  std::string get_whitelist_str() const { return whitelist_; }
  std::string get_whitelist_display() const;
  std::string get_whitelist_line(int index_0based) const;
  std::string get_whitelist_mac(int index_0based) const;
  std::string get_whitelist_label(int index_0based) const;

  // Historique recent sans doublon
  void add_recent_mac_no_duplicate(const std::string &mac,
                                   const std::string &name = "",
                                   const std::string &manuf_data = "",
                                   const std::string &uuids = "");
  std::string get_recent_mac(int index_0based) const;

  bool is_in_blacklist(const std::string &mac);
  void add_to_blacklist(const std::string &mac, const std::string &info = "");
  void remove_from_blacklist(const std::string &mac);
  std::string get_blacklist_str() const { return blacklist_; }

private:
  void load_all();
  void save_whitelist();
  void save_blacklist();
  static std::string normalize_mac(const std::string &mac);
  static std::string entry_mac_only(const std::string &entry);
  static bool list_contains(const std::string &list_csv,
                            const std::string &mac);
  static void list_add(std::string &list_csv, const std::string &mac,
                       const std::string &suffix = "");
  static void list_remove(std::string &list_csv, const std::string &mac);
  static void list_set_suffix(std::string &list_csv, const std::string &mac,
                              const std::string &suffix);

  std::string whitelist_;
  std::string blacklist_;
  std::vector<std::string>
      recent_macs_; // Stocke les MACs recemment vues (tampon non persistant)
};

} // namespace ble_persistent_lists
} // namespace esphome
