from config.database import get_db
from repositories.inbound_repository import InboundEntryRepository
from repositories.stock_movement_repository import StockMovementRepository
from repositories.stock_repository import StockRepository
from services.exceptions import ValidationError


class InboundService:
    def receive_goods(
        self,
        part_id: int,
        location_id: int,
        quantity: int,
        unit_price: float,
        created_by: str,
    ) -> None:
        """Tek bir mal girişini atomik olarak kaydeder: giriş kaydı + stok güncelleme + hareket kaydı."""
        if not part_id:
            raise ValidationError("Lütfen geçerli bir parça seçin.")
        if not location_id:
            raise ValidationError("Lütfen bir lokasyon seçin.")
        if quantity <= 0:
            raise ValidationError("Miktar sıfırdan büyük olmalıdır.")

        total_cost = quantity * unit_price
        with get_db() as db:
            InboundEntryRepository(db).create(
                part_id, quantity, unit_price, total_cost, created_by
            )
            StockRepository(db).upsert_increment(part_id, location_id, quantity)
            StockMovementRepository(db).create("Inbound", quantity)
            db.commit()

    def receive_goods_bulk(self, entries: list[dict]) -> None:
        """Excel toplu içe aktarım: tüm satırlar tek transaction'da, hepsi ya da hiçbiri."""
        with get_db() as db:
            inbound_repo = InboundEntryRepository(db)
            stock_repo = StockRepository(db)
            movement_repo = StockMovementRepository(db)

            for entry in entries:
                inbound_repo.create(
                    entry["part_id"],
                    entry["quantity"],
                    entry["unit_price"],
                    entry["total_cost"],
                    entry["created_by"],
                )
                stock_repo.upsert_increment(
                    entry["part_id"], entry["location_id"], entry["quantity"]
                )
                movement_repo.create("Inbound", entry["quantity"])

            db.commit()
