from config.database import get_db
from repositories.location_repository import LocationRepository
from typing import Optional
from services.exceptions import NotFoundError, ValidationError


class LocationService:
    def list_locations(self, search: Optional[str] = None) -> list[dict]:
        with get_db() as db:
            return [
                {"id": l.id, "name": l.name}
                for l in LocationRepository(db).get_all(search=search)
            ]

    def add_location(self, name: str) -> None:
        if not name:
            raise ValidationError("Lokasyon adı zorunludur.")
        with get_db() as db:
            LocationRepository(db).create(name)
            db.commit()

    def update_name(self, location_id: int, name: str) -> None:
        if not name:
            raise ValidationError("Lokasyon adı zorunludur.")
        with get_db() as db:
            location = LocationRepository(db).update_name(location_id, name)
            if location is None:
                raise NotFoundError("Lokasyon bulunamadı.")
            db.commit()

    def delete_location(self, location_id: int) -> None:
        with get_db() as db:
            deleted = LocationRepository(db).delete(location_id)
            if not deleted:
                raise NotFoundError("Lokasyon bulunamadı.")
            db.commit()
