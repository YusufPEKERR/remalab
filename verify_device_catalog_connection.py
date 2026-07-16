"""
DeviceCatalog entegrasyonunu doğrulamak için basit bir betik.

Kontrol eder:
  1. DeviceCatalog servisine bağlanılabiliyor mu (/health)
  2. Marka listesi çekilebiliyor mu (get_brands)
  3. Apple ve Samsung cihaz listeleri çekilebiliyor mu (get_devices)

Kullanım:
    python verify_device_catalog_connection.py
"""

import logging

import requests

from config.device_catalog import DEVICE_CATALOG_API_KEY, DEVICE_CATALOG_BASE_URL, DEVICE_CATALOG_TIMEOUT
from services import device_catalog_client as client
from services.exceptions import DeviceCatalogError

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def check_health() -> bool:
    try:
        response = requests.get(f"{DEVICE_CATALOG_BASE_URL}/health", timeout=DEVICE_CATALOG_TIMEOUT)
        response.raise_for_status()
        print(f"[OK] DeviceCatalog erişilebilir: {DEVICE_CATALOG_BASE_URL} -> {response.json()}")
        return True
    except requests.RequestException as exc:
        print(f"[HATA] DeviceCatalog'a ulaşılamadı ({DEVICE_CATALOG_BASE_URL}): {exc}")
        return False


def show_brands() -> None:
    brands = client.get_brands()
    print(f"[OK] {len(brands)} marka bulundu:")
    for brand in brands:
        print(f"   - {brand.brand}: {brand.device_count} cihaz (son senkron: {brand.last_synced_at})")


def show_devices_for_brand(brand: str, limit: int = 5) -> None:
    result = client.get_devices(brand=brand, limit=limit)
    print(f"[OK] {brand} için {result.total} kayıttan ilk {len(result.items)} tanesi:")
    for device in result.items:
        print(f"   - {device.model} | {device.storage} | {device.color}")


def main() -> int:
    if not DEVICE_CATALOG_API_KEY:
        print("[UYARI] DEVICE_CATALOG_API_KEY tanımlı değil (.env). Sadece /health kontrol edilecek.")

    if not check_health():
        return 1

    if not DEVICE_CATALOG_API_KEY:
        return 0

    try:
        show_brands()
        show_devices_for_brand("Apple")
        show_devices_for_brand("Samsung")
    except DeviceCatalogError as exc:
        print(f"[HATA] {exc}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
