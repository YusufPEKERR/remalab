"""
DeviceCatalog router'ı için testler.

- Mock'lu testler: ağ bağımlılığı yok, her zaman çalışır (CI güvenli).
- Canlı entegrasyon testi: gerçek DeviceCatalog servisine karşı RemaLab'in
  kendi API'si üzerinden Apple/Samsung cihazlarının okunabildiğini doğrular;
  DEVICE_CATALOG_API_KEY tanımlı değilse otomatik atlanır.
"""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from api.main import app
from config.device_catalog import DEVICE_CATALOG_API_KEY
from services import device_catalog_client
from services.exceptions import (
    DeviceCatalogAuthError,
    DeviceCatalogConnectionError,
    DeviceCatalogNotFoundError,
)

client = TestClient(app)

_SAMPLE_DEVICE = {
    "id": 130,
    "brand": "Apple",
    "category": "PHONE",
    "model_family": "iPhone 11",
    "model": "iPhone 11",
    "storage": "64GB",
    "color": "Purple",
    "manufacturer": "Apple Inc.",
    "source_url": "https://www.apple.com/iphone/compare/",
    "last_updated_at": datetime(2026, 7, 16, 11, 24, 7, tzinfo=timezone.utc),
    "is_active": True,
}


def test_get_brands_endpoint_success(monkeypatch):
    from api.schemas.device_catalog_schema import BrandInfo

    monkeypatch.setattr(
        device_catalog_client,
        "get_brands",
        lambda: [BrandInfo(brand="Apple", device_count=206, last_synced_at=None)],
    )

    response = client.get("/api/device-catalog/brands")

    assert response.status_code == 200
    assert response.json() == [{"brand": "Apple", "device_count": 206, "last_synced_at": None}]


def test_get_devices_endpoint_forwards_query_params(monkeypatch):
    from api.schemas.device_catalog_schema import DeviceListResponse

    captured = {}

    def fake_get_devices(**kwargs):
        captured.update(kwargs)
        return DeviceListResponse(total=1, limit=10, offset=0, items=[_SAMPLE_DEVICE])

    monkeypatch.setattr(device_catalog_client, "get_devices", fake_get_devices)

    response = client.get("/api/device-catalog/devices", params={"brand": "Apple", "limit": 10})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["model"] == "iPhone 11"
    assert captured["brand"] == "Apple"
    assert captured["limit"] == 10


def test_get_device_by_id_endpoint_success(monkeypatch):
    from api.schemas.device_catalog_schema import DeviceRead

    monkeypatch.setattr(device_catalog_client, "get_device_by_id", lambda device_id: DeviceRead(**_SAMPLE_DEVICE))

    response = client.get("/api/device-catalog/devices/130")

    assert response.status_code == 200
    assert response.json()["model"] == "iPhone 11"


def test_get_device_by_id_endpoint_not_found_returns_404(monkeypatch):
    def raise_not_found(device_id):
        raise DeviceCatalogNotFoundError("İstenen kayıt DeviceCatalog'da bulunamadı.")

    monkeypatch.setattr(device_catalog_client, "get_device_by_id", raise_not_found)

    response = client.get("/api/device-catalog/devices/999999999")

    assert response.status_code == 404


def test_search_endpoint_success(monkeypatch):
    from api.schemas.device_catalog_schema import DeviceListResponse

    captured = {}

    def fake_search_devices(query, brand=None, limit=50, offset=0):
        captured["query"] = query
        captured["brand"] = brand
        return DeviceListResponse(total=1, limit=limit, offset=offset, items=[_SAMPLE_DEVICE])

    monkeypatch.setattr(device_catalog_client, "search_devices", fake_search_devices)

    response = client.get("/api/device-catalog/search", params={"q": "iPhone 11", "brand": "Apple"})

    assert response.status_code == 200
    assert captured["query"] == "iPhone 11"
    assert captured["brand"] == "Apple"


def test_search_endpoint_requires_query_param():
    response = client.get("/api/device-catalog/search")
    assert response.status_code == 422


def test_connection_error_maps_to_503(monkeypatch):
    def raise_connection_error():
        raise DeviceCatalogConnectionError("DeviceCatalog servisine bağlanılamadı.")

    monkeypatch.setattr(device_catalog_client, "get_brands", raise_connection_error)

    response = client.get("/api/device-catalog/brands")

    assert response.status_code == 503


def test_auth_error_maps_to_502(monkeypatch):
    def raise_auth_error():
        raise DeviceCatalogAuthError("DeviceCatalog API key geçersiz veya eksik.")

    monkeypatch.setattr(device_catalog_client, "get_brands", raise_auth_error)

    response = client.get("/api/device-catalog/brands")

    assert response.status_code == 502


@pytest.mark.skipif(not DEVICE_CATALOG_API_KEY, reason="DEVICE_CATALOG_API_KEY tanımlı değil, canlı test atlanıyor.")
def test_live_remalab_api_reads_apple_and_samsung_devices():
    """RemaLab'in kendi API'si üzerinden gerçek DeviceCatalog servisinden
    Apple ve Samsung cihazlarının okunabildiğini uçtan uca doğrular.
    """
    for brand in ("Apple", "Samsung"):
        response = client.get("/api/device-catalog/devices", params={"brand": brand, "limit": 5})
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["total"] > 0
        assert all(item["brand"] == brand for item in body["items"])
