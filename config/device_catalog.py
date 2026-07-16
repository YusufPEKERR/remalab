"""
RemaLab WMS - DeviceCatalog Servis Konfigürasyonu
DeviceCatalog API'sine bağlanmak için gereken ayarlar .env üzerinden okunur.
"""

import os
from dotenv import load_dotenv

load_dotenv()

DEVICE_CATALOG_BASE_URL = os.getenv("DEVICE_CATALOG_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
DEVICE_CATALOG_API_KEY = os.getenv("DEVICE_CATALOG_API_KEY", "")
DEVICE_CATALOG_TIMEOUT = float(os.getenv("DEVICE_CATALOG_TIMEOUT", "10"))
