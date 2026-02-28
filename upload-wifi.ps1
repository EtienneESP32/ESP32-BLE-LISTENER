# Compile et upload en OTA (WiFi) sans demander COM3
# IP du module : 192.168.1.225 (voir esphome/secrets.yaml)
Set-Location $PSScriptRoot
py -3 -m esphome run esphome/ble-sniffer.yaml --device 192.168.1.225
