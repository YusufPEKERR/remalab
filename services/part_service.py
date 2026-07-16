from config.database import get_db
from repositories.part_repository import PartRepository
from typing import Optional
from services import device_catalog_client
from services.exceptions import DeviceCatalogError, DeviceCatalogNotFoundError, NotFoundError, ValidationError
from sqlalchemy.exc import IntegrityError

# models/part.py içindeki Column(String(N)) sınırlarıyla birebir eşleşir.
_BRAND_MAX_LENGTH = 100
_MODEL_MAX_LENGTH = 100
_MEMORY_MAX_LENGTH = 50
_COLOR_MAX_LENGTH = 50


class PartService:
    def list_parts(self, search: Optional[str] = None) -> list[dict]:
        with get_db() as db:
            return [
                {"id": p.id, "name": p.name}
                for p in PartRepository(db).get_all(search=search)
            ]

    def add_part(
        self,
        name: str,
        barcode: Optional[str] = None,
        brand: Optional[str] = None,
        model: Optional[str] = None,
        memory: Optional[str] = None,
        color: Optional[str] = None,
        device_catalog_id: Optional[int] = None,
    ) -> int:
        """Yeni parça oluşturur.

        brand/model/memory/color doğrudan verilebilir, ya da `device_catalog_id`
        ile DeviceCatalog'dan bir cihaz seçilip bu alanlar oradan doldurulabilir.
        `device_catalog_id` sadece bu alanları çekmek için kullanılır; kalıcı
        olarak saklanmaz (parts tablosunda böyle bir kolon yok).
        """
        if not name:
            raise ValidationError("Parça adı zorunludur.")

        if device_catalog_id is not None:
            brand, model, memory, color = self._resolve_device_catalog_fields(device_catalog_id)

        brand = self._validate_catalog_field("Marka", brand, _BRAND_MAX_LENGTH)
        model = self._validate_catalog_field("Model", model, _MODEL_MAX_LENGTH)
        memory = self._validate_catalog_field("Depolama", memory, _MEMORY_MAX_LENGTH)
        color = self._validate_catalog_field("Renk", color, _COLOR_MAX_LENGTH)

        with get_db() as db:
            try:
                part = PartRepository(db).create(
                    name,
                    barcode=barcode,
                    brand=brand,
                    model=model,
                    memory=memory,
                    color=color,
                )
                db.commit()
                return part.id
            except IntegrityError:
                db.rollback()
                raise ValidationError(
                    "Bu isimde bir parça zaten mevcut (veya veritabanı kısıtlaması hatası)."
                )

    @staticmethod
    def _resolve_device_catalog_fields(
        device_catalog_id: int,
    ) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
        """DeviceCatalog'dan cihazı çeker ve (brand, model, storage, color) döner.

        Servis katmanının dışına yalnızca ServiceError alt sınıfları (ValidationError)
        sızar; DeviceCatalog'a özel hatalar burada anlamlı mesajlara çevrilir.
        """
        if not isinstance(device_catalog_id, int) or isinstance(device_catalog_id, bool) or device_catalog_id <= 0:
            raise ValidationError("Geçersiz DeviceCatalog cihaz id'si.")

        try:
            device = device_catalog_client.get_device_by_id(device_catalog_id)
        except DeviceCatalogNotFoundError:
            raise ValidationError(f"DeviceCatalog'da {device_catalog_id} id'li bir cihaz bulunamadı.")
        except DeviceCatalogError as exc:
            raise ValidationError(f"DeviceCatalog'dan cihaz bilgisi alınamadı: {exc}")

        return device.brand, device.model, device.storage, device.color

    @staticmethod
    def _validate_catalog_field(label: str, value: Optional[str], max_length: int) -> Optional[str]:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValidationError(f"{label} alanı metin olmalıdır.")
        cleaned = value.strip()
        if not cleaned:
            return None
        if len(cleaned) > max_length:
            raise ValidationError(f"{label} alanı en fazla {max_length} karakter olabilir.")
        return cleaned

    def update_name(self, part_id: int, name: str) -> None:
        if not name:
            raise ValidationError("Parça adı zorunludur.")
        with get_db() as db:
            try:
                part = PartRepository(db).update_name(part_id, name)
                if part is None:
                    raise NotFoundError("Parça bulunamadı.")
                db.commit()
            except IntegrityError:
                db.rollback()
                raise ValidationError("Bu isimde bir parça zaten mevcut.")

    def delete_part(self, part_id: int) -> None:
        with get_db() as db:
            try:
                deleted = PartRepository(db).delete(part_id)
                if not deleted:
                    raise NotFoundError("Parça bulunamadı.")
                db.commit()
            except IntegrityError:
                db.rollback()
                raise ValidationError(
                    "Bu parça başka bir yerde kullanıldığı için silinemez."
                )
