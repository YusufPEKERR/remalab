"""
RemaLab WMS – CustomerTargetServicePrice (Müşteri Hedef Servis Fiyatı) Modeli
Organization şeması.

İş Kuralı:
  Servis giriş şablonunda power test ve screen testten en az biri NOK ise
  cihaz yüksek bütçeyi (target_price) aşmayacak şekilde onarılır.
  Her ikisi de OK ise cihaz düşük bütçe (light_repair_target_price)
  kapsamında onarılır. Onarım maliyeti bütçeyi aşarsa cihaz otomatik
  iade (RMA) edilir.
"""

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class CustomerTargetServicePrice(Base):
    """Müşteri bazında ürün ailesi hedef servis fiyatlandırma kuralı."""
    __tablename__ = "customer_target_service_prices"
    __table_args__ = {"schema": "organization"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organization.customers.id"),
        nullable=False,
    )
    product_family = Column(String(100), nullable=False)
    code = Column(String(100), unique=True, nullable=False)
    target_price = Column(Numeric(10, 2), nullable=False, comment="Yüksek bütçe (NOK)")
    light_repair_target_price = Column(
        Numeric(10, 2), nullable=False, comment="Düşük bütçe (OK)"
    )
    family_validation_id = Column(UUID(as_uuid=True), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)

    # İlişkiler
    customer_rel = relationship("Customer", back_populates="target_service_prices")

    def get_applicable_budget(
        self, power_test_ok: bool, screen_test_ok: bool
    ) -> dict:
        """
        Bütçe kuralını uygular.

        Args:
            power_test_ok: Power test sonucu (True=OK, False=NOK)
            screen_test_ok: Screen test sonucu (True=OK, False=NOK)

        Returns:
            dict: {
                "budget_type": "HIGH" veya "LOW",
                "budget_amount": Decimal,
                "description": str
            }
        """
        if not power_test_ok or not screen_test_ok:
            # En az biri NOK → yüksek bütçe
            return {
                "budget_type": "HIGH",
                "budget_amount": self.target_price,
                "description": "Test NOK – yüksek bütçe uygulanır",
            }
        else:
            # Her ikisi OK → düşük bütçe
            return {
                "budget_type": "LOW",
                "budget_amount": self.light_repair_target_price,
                "description": "Testler OK – düşük bütçe uygulanır",
            }

    def should_rma(
        self, repair_cost: float, power_test_ok: bool, screen_test_ok: bool
    ) -> bool:
        """
        Onarım maliyeti bütçeyi aşıyorsa RMA'ya yönlendirilmeli mi?

        Args:
            repair_cost: Toplam onarım maliyeti
            power_test_ok: Power test sonucu
            screen_test_ok: Screen test sonucu

        Returns:
            True ise cihaz RMA'ya yönlendirilir.
        """
        budget = self.get_applicable_budget(power_test_ok, screen_test_ok)
        return float(repair_cost) > float(budget["budget_amount"])
