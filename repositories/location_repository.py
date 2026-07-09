from sqlalchemy import select
from sqlalchemy.orm import Session

from models.location import Location


class LocationRepository:
    """warehouse.locations tablosuna ham DB erişimi. Commit/rollback yönetmez."""

    def __init__(self, db: Session):
        self.db = db

    def get_all(self, search: str | None = None) -> list[Location]:
        stmt = select(Location).order_by(Location.id.desc())
        if search:
            stmt = stmt.where(Location.name.ilike(f"%{search}%"))
        return list(self.db.execute(stmt).scalars().all())

    def get_by_id(self, location_id: int) -> Location | None:
        return self.db.get(Location, location_id)

    def create(self, name: str) -> Location:
        location = Location(name=name)
        self.db.add(location)
        self.db.flush()
        return location

    def update_name(self, location_id: int, name: str) -> Location | None:
        location = self.db.get(Location, location_id)
        if location is None:
            return None
        location.name = name
        self.db.flush()
        return location

    def delete(self, location_id: int) -> bool:
        location = self.db.get(Location, location_id)
        if location is None:
            return False
        self.db.delete(location)
        self.db.flush()
        return True
