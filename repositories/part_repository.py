from sqlalchemy import select, or_, cast, String
from sqlalchemy.orm import Session
from typing import Optional

from models.part import Part


class PartRepository:
    """warehouse.parts tablosuna ham DB erişimi. Commit/rollback yönetmez."""

    def __init__(self, db: Session):
        self.db = db

    def get_all(self, search: Optional[str] = None) -> list[Part]:
        stmt = select(Part).order_by(Part.id.desc())
        if search:
            stmt = stmt.where(
                or_(
                    Part.name.ilike(f"%{search}%"),
                    cast(Part.id, String).ilike(f"%{search}%")
                )
            )
        return list(self.db.execute(stmt).scalars().all())

    def get_by_id(self, part_id: int) -> Optional[Part]:
        return self.db.get(Part, part_id)

    def create(self, name: str, barcode: Optional[str] = None) -> Part:
        part = Part(name=name, barcode=barcode)
        self.db.add(part)
        self.db.flush()
        return part

    def update_name(self, part_id: int, name: str) -> Optional[Part]:
        part = self.db.get(Part, part_id)
        if part is None:
            return None
        part.name = name
        self.db.flush()
        return part

    def delete(self, part_id: int) -> bool:
        part = self.db.get(Part, part_id)
        if part is None:
            return False
        self.db.delete(part)
        self.db.flush()
        return True
