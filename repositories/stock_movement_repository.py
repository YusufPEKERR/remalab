from sqlalchemy.orm import Session

from models.stock_movement import StockMovement


class StockMovementRepository:
    """warehouse.stock_movements tablosuna ham DB erişimi. Commit/rollback yönetmez."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, movement_type: str, quantity: int) -> StockMovement:
        movement = StockMovement(type=movement_type, quantity=quantity)
        self.db.add(movement)
        self.db.flush()
        return movement
