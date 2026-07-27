from sqlalchemy.orm import Session

from models.outbound_entry import OutboundEntry


class OutboundEntryRepository:
    """warehouse.outbound_entries tablosuna ham DB erişimi. Commit/rollback yönetmez."""

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        part_id: int,
        location_id: int,
        quantity: int,
        destination: str,
        created_by: str,
        outbound_type: str = None,
        description: str = None,
    ) -> OutboundEntry:
        entry = OutboundEntry(
            part_id=part_id,
            location_id=location_id,
            quantity=quantity,
            destination=destination,
            created_by=created_by,
            outbound_type=outbound_type,
            description=description,
        )
        self.db.add(entry)
        self.db.flush()
        return entry
