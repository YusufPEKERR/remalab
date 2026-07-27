from sqlalchemy.orm import Session

from models.stock_movement import StockMovement


class StockMovementRepository:
    """warehouse.stock_movements tablosuna ham DB erişimi. Commit/rollback yönetmez."""

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        movement_type: str,
        quantity: int,
        part_id: int = None,
        source_location_id: int = None,
        target_location_id: int = None,
        created_by: str = None,
        unit_price: float = None,
        total_cost: float = None,
    ) -> StockMovement:
        movement = StockMovement(
            type=movement_type,
            quantity=quantity,
            part_id=part_id,
            source_location_id=source_location_id,
            target_location_id=target_location_id,
            created_by=created_by,
            unit_price=unit_price,
            total_cost=total_cost,
        )
        self.db.add(movement)
        self.db.flush()
        return movement
