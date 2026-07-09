from sqlalchemy import select
from sqlalchemy.orm import Session

from models.stock import Stock


class StockRepository:
    """warehouse.stock tablosuna ham DB erişimi. Commit/rollback yönetmez."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, stock_id: int) -> Stock | None:
        return self.db.get(Stock, stock_id)

    def get_by_part_location(self, part_id: int, location_id: int) -> Stock | None:
        stmt = select(Stock).where(
            Stock.part_id == part_id, Stock.location_id == location_id
        )
        return self.db.execute(stmt).scalars().first()

    def create(self, part_id: int, location_id: int, quantity: int) -> Stock:
        stock = Stock(part_id=part_id, location_id=location_id, quantity=quantity)
        self.db.add(stock)
        self.db.flush()
        return stock

    def increment(self, stock_id: int, quantity: int) -> Stock:
        stock = self.db.get(Stock, stock_id)
        stock.quantity += quantity
        self.db.flush()
        return stock

    def decrement(self, stock_id: int, quantity: int) -> Stock:
        stock = self.db.get(Stock, stock_id)
        stock.quantity -= quantity
        self.db.flush()
        return stock

    def upsert_increment(self, part_id: int, location_id: int, quantity: int) -> Stock:
        """Mal girişi: satır varsa miktarı artırır, yoksa yeni satır oluşturur."""
        existing = self.get_by_part_location(part_id, location_id)
        if existing:
            return self.increment(existing.id, quantity)
        return self.create(part_id, location_id, quantity)

    def set_quantity(self, stock_id: int, quantity: int) -> Stock | None:
        stock = self.db.get(Stock, stock_id)
        if stock is None:
            return None
        stock.quantity = quantity
        self.db.flush()
        return stock
