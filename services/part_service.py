from config.database import get_db
from repositories.part_repository import PartRepository
from services.exceptions import NotFoundError, ValidationError


class PartService:
    def list_parts(self, search: str | None = None) -> list[dict]:
        with get_db() as db:
            return [
                {"id": p.id, "name": p.name}
                for p in PartRepository(db).get_all(search=search)
            ]

    def add_part(self, name: str, barcode: str | None = None) -> int:
        if not name:
            raise ValidationError("Parça adı zorunludur.")
        with get_db() as db:
            part = PartRepository(db).create(name, barcode=barcode)
            db.commit()
            return part.id

    def update_name(self, part_id: int, name: str) -> None:
        if not name:
            raise ValidationError("Parça adı zorunludur.")
        with get_db() as db:
            part = PartRepository(db).update_name(part_id, name)
            if part is None:
                raise NotFoundError("Parça bulunamadı.")
            db.commit()

    def delete_part(self, part_id: int) -> None:
        with get_db() as db:
            deleted = PartRepository(db).delete(part_id)
            if not deleted:
                raise NotFoundError("Parça bulunamadı.")
            db.commit()
