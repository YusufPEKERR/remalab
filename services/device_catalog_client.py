"""
RemaLab WMS - DeviceCatalog API İstemcisi

Yeni parça/servis kaydı oluştururken cihaz bilgilerini (marka, model,
depolama, renk vb.) harici DeviceCatalog servisinden çekmek için kullanılır.

Base URL ve API key config/device_catalog.py üzerinden (.env) yönetilir.
"""

import logging
from typing import Optional

import requests

from api.schemas.device_catalog_schema import BrandInfo, DeviceCategory, DeviceListResponse, DeviceRead
from config.device_catalog import DEVICE_CATALOG_API_KEY, DEVICE_CATALOG_BASE_URL, DEVICE_CATALOG_TIMEOUT
from services.exceptions import DeviceCatalogAuthError, DeviceCatalogConnectionError, DeviceCatalogError, DeviceCatalogNotFoundError

logger = logging.getLogger(__name__)

_session: Optional[requests.Session] = None


def _get_session() -> requests.Session:
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update({"X-API-Key": DEVICE_CATALOG_API_KEY})
    return _session


def _request(method: str, path: str, params: Optional[dict] = None) -> dict:
    url = f"{DEVICE_CATALOG_BASE_URL}{path}"
    try:
        response = _get_session().request(method, url, params=params, timeout=DEVICE_CATALOG_TIMEOUT)
    except requests.exceptions.Timeout as exc:
        logger.error("DeviceCatalog isteği zaman aşımına uğradı: %s %s (%s)", method, url, exc)
        raise DeviceCatalogConnectionError("DeviceCatalog servisine bağlanırken zaman aşımı oluştu.") from exc
    except requests.exceptions.ConnectionError as exc:
        logger.error("DeviceCatalog servisine bağlanılamadı: %s %s (%s)", method, url, exc)
        raise DeviceCatalogConnectionError("DeviceCatalog servisine bağlanılamadı.") from exc
    except requests.exceptions.RequestException as exc:
        logger.error("DeviceCatalog isteği başarısız oldu: %s %s (%s)", method, url, exc)
        raise DeviceCatalogConnectionError("DeviceCatalog isteği başarısız oldu.") from exc

    if response.status_code in (401, 403):
        logger.error("DeviceCatalog kimlik doğrulama hatası: %s %s -> %s", method, url, response.status_code)
        raise DeviceCatalogAuthError("DeviceCatalog API key geçersiz veya eksik.")

    if response.status_code == 404:
        logger.warning("DeviceCatalog kayıt bulunamadı: %s %s", method, url)
        raise DeviceCatalogNotFoundError("İstenen kayıt DeviceCatalog'da bulunamadı.")

    if response.status_code >= 400:
        logger.error(
            "DeviceCatalog HTTP hatası: %s %s -> %s %s",
            method,
            url,
            response.status_code,
            response.text[:500],
        )
        raise DeviceCatalogError(f"DeviceCatalog isteği {response.status_code} ile başarısız oldu.")

    return response.json()


def get_brands() -> list[BrandInfo]:
    """DeviceCatalog'daki tüm markaları ve cihaz sayılarını döner."""
    data = _request("GET", "/brands")
    return [BrandInfo(**item) for item in data]


def get_devices(
    brand: Optional[str] = None,
    category: Optional[DeviceCategory] = None,
    model_family: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> DeviceListResponse:
    """Filtrelenmiş cihaz listesini sayfalı şekilde döner."""
    params = {
        "brand": brand,
        "category": category.value if isinstance(category, DeviceCategory) else category,
        "model_family": model_family,
        "is_active": is_active,
        "search": search,
        "limit": limit,
        "offset": offset,
    }
    params = {key: value for key, value in params.items() if value is not None}
    data = _request("GET", "/devices", params=params)
    return DeviceListResponse(**data)


def search_devices(query: str, brand: Optional[str] = None, limit: int = 50, offset: int = 0) -> DeviceListResponse:
    """Model adında serbest metin araması yapar (get_devices'in search parametresi üzerinden)."""
    return get_devices(brand=brand, search=query, limit=limit, offset=offset)


def get_device_by_id(device_id: int) -> DeviceRead:
    """Tek bir cihazı id ile getirir. Bulunamazsa DeviceCatalogNotFoundError fırlatır."""
    data = _request("GET", f"/devices/{device_id}")
    return DeviceRead(**data)
