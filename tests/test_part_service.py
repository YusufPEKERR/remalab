"""
PartService.add_part() ve PartRepository.create()'in DeviceCatalog entegrasyonu
için birim testleri. Gerçek veritabanına veya DeviceCatalog servisine bağlanmaz.
"""

from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest

from repositories.part_repository import PartRepository
from services import device_catalog_client, part_service as part_service_module
from services.exceptions import DeviceCatalogConnectionError, DeviceCatalogNotFoundError, ValidationError
from services.part_service import PartService


# ---------------------------------------------------------------------------
# PartRepository.create() - brand/model/memory/color alanları
# ---------------------------------------------------------------------------


def test_repository_create_saves_catalog_fields():
    db = MagicMock()
    repo = PartRepository(db)

    part = repo.create("Ekran", barcode="123", brand="Apple", model="iPhone 13", memory="128 GB", color="Blue")

    assert part.name == "Ekran"
    assert part.barcode == "123"
    assert part.brand == "Apple"
    assert part.model == "iPhone 13"
    assert part.memory == "128 GB"
    assert part.color == "Blue"
    db.add.assert_called_once_with(part)
    db.flush.assert_called_once()


def test_repository_create_backward_compatible_without_catalog_fields():
    db = MagicMock()
    repo = PartRepository(db)

    part = repo.create("Ekran")

    assert part.name == "Ekran"
    assert part.barcode is None
    assert part.brand is None
    assert part.model is None
    assert part.memory is None
    assert part.color is None


# ---------------------------------------------------------------------------
# PartService.add_part()
# ---------------------------------------------------------------------------


class _FakePartRepository:
    """PartRepository yerine geçer; create() çağrısını yakalar."""

    last_create_kwargs = None

    def __init__(self, db):
        self.db = db

    def create(self, name, barcode=None, brand=None, model=None, memory=None, color=None):
        _FakePartRepository.last_create_kwargs = dict(
            name=name, barcode=barcode, brand=brand, model=model, memory=memory, color=color
        )
        return MagicMock(id=42)


@pytest.fixture(autouse=True)
def _patch_get_db(monkeypatch):
    fake_db = MagicMock()

    @contextmanager
    def fake_get_db():
        yield fake_db

    monkeypatch.setattr(part_service_module, "get_db", fake_get_db)
    monkeypatch.setattr(part_service_module, "PartRepository", _FakePartRepository)
    _FakePartRepository.last_create_kwargs = None
    yield fake_db


def test_add_part_backward_compatible_name_and_barcode_only(_patch_get_db):
    part_id = PartService().add_part("Ekran Kartı", barcode="BC-1")

    assert part_id == 42
    assert _FakePartRepository.last_create_kwargs == {
        "name": "Ekran Kartı",
        "barcode": "BC-1",
        "brand": None,
        "model": None,
        "memory": None,
        "color": None,
    }
    _patch_get_db.commit.assert_called_once()


def test_add_part_with_explicit_brand_model_memory_color_trims_whitespace():
    PartService().add_part(
        "Ekran Kartı",
        brand="  Apple  ",
        model=" iPhone 13 ",
        memory=" 128 GB ",
        color=" Blue ",
    )

    assert _FakePartRepository.last_create_kwargs == {
        "name": "Ekran Kartı",
        "barcode": None,
        "brand": "Apple",
        "model": "iPhone 13",
        "memory": "128 GB",
        "color": "Blue",
    }


def test_add_part_blank_catalog_field_becomes_none():
    PartService().add_part("Ekran Kartı", brand="   ")

    assert _FakePartRepository.last_create_kwargs["brand"] is None


@pytest.mark.parametrize(
    "field,value",
    [
        ("brand", "x" * 101),
        ("model", "x" * 101),
        ("memory", "x" * 51),
        ("color", "x" * 51),
    ],
)
def test_add_part_rejects_fields_exceeding_column_length(field, value):
    with pytest.raises(ValidationError):
        PartService().add_part("Ekran Kartı", **{field: value})


def test_add_part_rejects_non_string_catalog_field():
    with pytest.raises(ValidationError):
        PartService().add_part("Ekran Kartı", brand=123)


def test_add_part_without_name_raises_validation_error():
    with pytest.raises(ValidationError):
        PartService().add_part("")


def test_add_part_with_device_catalog_id_resolves_fields(monkeypatch):
    fake_device = MagicMock(brand="Apple", model="iPhone 13", storage="128 GB", color="Blue")
    monkeypatch.setattr(device_catalog_client, "get_device_by_id", lambda device_id: fake_device)

    part_id = PartService().add_part("Ekran Kartı", device_catalog_id=130)

    assert part_id == 42
    assert _FakePartRepository.last_create_kwargs == {
        "name": "Ekran Kartı",
        "barcode": None,
        "brand": "Apple",
        "model": "iPhone 13",
        "memory": "128 GB",
        "color": "Blue",
    }
    # device_catalog_id kalıcı olarak saklanmıyor; repository'ye hiç geçmiyor.
    assert "device_catalog_id" not in _FakePartRepository.last_create_kwargs


def test_add_part_device_catalog_id_overrides_manual_fields(monkeypatch):
    fake_device = MagicMock(brand="Apple", model="iPhone 13", storage="128 GB", color="Blue")
    monkeypatch.setattr(device_catalog_client, "get_device_by_id", lambda device_id: fake_device)

    PartService().add_part("Ekran Kartı", device_catalog_id=130, brand="ManuelMarka", color="ManuelRenk")

    assert _FakePartRepository.last_create_kwargs["brand"] == "Apple"
    assert _FakePartRepository.last_create_kwargs["color"] == "Blue"


def test_add_part_device_catalog_not_found_raises_validation_error(monkeypatch):
    def raise_not_found(device_id):
        raise DeviceCatalogNotFoundError("bulunamadı")

    monkeypatch.setattr(device_catalog_client, "get_device_by_id", raise_not_found)

    with pytest.raises(ValidationError):
        PartService().add_part("Ekran Kartı", device_catalog_id=999999)


def test_add_part_device_catalog_connection_error_raises_validation_error(monkeypatch):
    def raise_connection_error(device_id):
        raise DeviceCatalogConnectionError("bağlanılamadı")

    monkeypatch.setattr(device_catalog_client, "get_device_by_id", raise_connection_error)

    with pytest.raises(ValidationError):
        PartService().add_part("Ekran Kartı", device_catalog_id=1)


def test_add_part_invalid_device_catalog_id_skips_network_call(monkeypatch):
    calls = []
    monkeypatch.setattr(device_catalog_client, "get_device_by_id", lambda device_id: calls.append(device_id))

    with pytest.raises(ValidationError):
        PartService().add_part("Ekran Kartı", device_catalog_id=-1)

    assert calls == []
