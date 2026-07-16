"""
DeviceCatalog istemcisi için birim testleri.
Gerçek ağ çağrısı yapmaz; requests.Session.request mock'lanır.
"""

from unittest.mock import MagicMock, patch

import pytest
import requests

from services import device_catalog_client as client
from services.exceptions import (
    DeviceCatalogAuthError,
    DeviceCatalogConnectionError,
    DeviceCatalogError,
    DeviceCatalogNotFoundError,
)


def _fake_response(status_code: int, json_data=None, text: str = ""):
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = json_data
    response.text = text
    return response


@pytest.fixture(autouse=True)
def _reset_session():
    client._session = None
    yield
    client._session = None


def test_get_brands_success():
    fake = _fake_response(
        200,
        [
            {"brand": "Apple", "device_count": 634, "last_synced_at": "2026-07-16T09:19:56Z"},
            {"brand": "Samsung", "device_count": 120, "last_synced_at": None},
        ],
    )
    with patch.object(requests.Session, "request", return_value=fake) as mock_request:
        brands = client.get_brands()

    assert [b.brand for b in brands] == ["Apple", "Samsung"]
    assert brands[0].device_count == 634
    mock_request.assert_called_once()
    assert mock_request.call_args.args[1] == f"{client.DEVICE_CATALOG_BASE_URL}/brands"


def test_get_devices_filters_none_values_and_parses_response():
    fake = _fake_response(
        200,
        {
            "total": 1,
            "limit": 50,
            "offset": 0,
            "items": [
                {
                    "id": 1,
                    "brand": "Apple",
                    "category": "PHONE",
                    "model_family": "iPhone 13",
                    "model": "iPhone 13",
                    "storage": "128 GB",
                    "color": "Blue",
                    "manufacturer": "Apple",
                    "source_url": "https://support.apple.com/en-us/111872",
                    "last_updated_at": "2026-07-16T09:19:56Z",
                    "is_active": True,
                }
            ],
        },
    )
    with patch.object(requests.Session, "request", return_value=fake) as mock_request:
        result = client.get_devices(brand="Apple")

    assert result.total == 1
    assert result.items[0].model == "iPhone 13"
    sent_params = mock_request.call_args.kwargs["params"]
    assert sent_params == {"brand": "Apple", "limit": 50, "offset": 0}


def test_search_devices_uses_search_param():
    fake = _fake_response(200, {"total": 0, "limit": 50, "offset": 0, "items": []})
    with patch.object(requests.Session, "request", return_value=fake) as mock_request:
        client.search_devices("iPhone 15", brand="Apple")

    sent_params = mock_request.call_args.kwargs["params"]
    assert sent_params["search"] == "iPhone 15"
    assert sent_params["brand"] == "Apple"


def test_get_device_by_id_not_found_raises():
    fake = _fake_response(404, text="Not Found")
    with patch.object(requests.Session, "request", return_value=fake):
        with pytest.raises(DeviceCatalogNotFoundError):
            client.get_device_by_id(999999)


def test_invalid_api_key_raises_auth_error():
    fake = _fake_response(401, json_data={"detail": "Invalid API key"})
    with patch.object(requests.Session, "request", return_value=fake):
        with pytest.raises(DeviceCatalogAuthError):
            client.get_brands()


def test_server_error_raises_generic_device_catalog_error():
    fake = _fake_response(500, text="Internal Server Error")
    with patch.object(requests.Session, "request", return_value=fake):
        with pytest.raises(DeviceCatalogError):
            client.get_brands()


def test_connection_error_is_wrapped():
    with patch.object(requests.Session, "request", side_effect=requests.exceptions.ConnectionError("boom")):
        with pytest.raises(DeviceCatalogConnectionError):
            client.get_brands()


def test_timeout_is_wrapped():
    with patch.object(requests.Session, "request", side_effect=requests.exceptions.Timeout("boom")):
        with pytest.raises(DeviceCatalogConnectionError):
            client.get_brands()
