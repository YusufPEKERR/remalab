from sqlalchemy.orm import Session

from models.inbound_entry import InboundEntry


class InboundEntryRepository:
    """warehouse.inbound_entries tablosuna ham DB erişimi. Commit/rollback yönetmez."""

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        part_id: int,
        quantity: int,
        unit_price: float,
        total_cost: float,
        created_by: str,
    ) -> InboundEntry:
        entry = InboundEntry(
            part_id=part_id,
            quantity=quantity,
            unit_price=unit_price,
            total_cost=total_cost,
            created_by=created_by,
        )
        self.db.add(entry)
        self.db.flush()
        return entry
