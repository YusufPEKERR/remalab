from config.database import get_db
from repositories.outbound_repository import OutboundEntryRepository
from repositories.stock_movement_repository import StockMovementRepository
from repositories.stock_repository import StockRepository
from services.exceptions import InsufficientStockError, NotFoundError, ValidationError


class OutboundService:
    def ship_goods(
        self, stock_id: int, quantity: int, destination: str, created_by: str
    ) -> None:
        """Tek bir stok çıkışını atomik olarak kaydeder: çıkış kaydı + stok azaltma + hareket kaydı."""
        if not destination:
            raise ValidationError("Lütfen bir alıcı/hedef girin.")
        if quantity <= 0:
            raise ValidationError("Miktar sıfırdan büyük olmalıdır.")

        with get_db() as db:
            stock_repo = StockRepository(db)
            stock = stock_repo.get_by_id(stock_id)
            if stock is None:
                raise NotFoundError("Stok kaydı bulunamadı.")
            if quantity > stock.quantity:
                raise InsufficientStockError("Seçilen lokasyonda yeterli stok bulunmuyor.")

            OutboundEntryRepository(db).create(
                stock.part_id, stock.location_id, quantity, destination, created_by
            )
            stock_repo.decrement(stock.id, quantity)
            StockMovementRepository(db).create("Outbound", quantity)
            db.commit()

    def ship_goods_bulk(self, entries: list[dict]) -> dict:
        """Excel toplu çıkış. Stok yetersiz olan satırlar atlanır (mevcut davranış),
        işlenenler tek transaction'da kaydedilir."""
        with get_db() as db:
            stock_repo = StockRepository(db)
            outbound_repo = OutboundEntryRepository(db)
            movement_repo = StockMovementRepository(db)

            processed = 0
            skipped = 0
            for entry in entries:
                stock = stock_repo.get_by_part_location(
                    entry["part_id"], entry["location_id"]
                )
                if stock is None or stock.quantity < entry["quantity"]:
                    skipped += 1
                    continue

                outbound_repo.create(
                    entry["part_id"],
                    entry["location_id"],
                    entry["quantity"],
                    entry["destination"],
                    entry["created_by"],
                )
                stock_repo.decrement(stock.id, entry["quantity"])
                movement_repo.create("Outbound", entry["quantity"])
                processed += 1

            db.commit()
            return {"processed": processed, "skipped": skipped}
