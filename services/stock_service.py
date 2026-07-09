from config.database import get_db
from repositories.stock_movement_repository import StockMovementRepository
from repositories.stock_repository import StockRepository
from services.exceptions import InsufficientStockError, NotFoundError, ValidationError


class StockService:
    def transfer(
        self, source_stock_id: int, target_location_id: int, quantity: int
    ) -> None:
        """Bir stok satırından başka bir lokasyona atomik transfer: kaynaktan düş,
        hedefe ekle/oluştur, hareket kaydı oluştur."""
        if quantity <= 0:
            raise ValidationError("Miktar sıfırdan büyük olmalıdır.")

        with get_db() as db:
            stock_repo = StockRepository(db)
            source = stock_repo.get_by_id(source_stock_id)
            if source is None:
                raise NotFoundError("Kaynak stok kaydı bulunamadı.")
            if source.quantity < quantity:
                raise InsufficientStockError(
                    "Kaynak lokasyonda yeterli stok bulunmuyor."
                )

            stock_repo.decrement(source.id, quantity)
            stock_repo.upsert_increment(source.part_id, target_location_id, quantity)
            StockMovementRepository(db).create("Transfer", quantity)
            db.commit()

    def set_quantity(self, stock_id: int, quantity: int) -> None:
        """Satır içi düzeltme: hareket kaydı oluşturmadan doğrudan miktarı ayarlar."""
        if quantity < 0:
            raise ValidationError("Miktar negatif olamaz.")

        with get_db() as db:
            stock = StockRepository(db).set_quantity(stock_id, quantity)
            if stock is None:
                raise NotFoundError("Stok kaydı bulunamadı.")
            db.commit()
