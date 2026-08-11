"""
RemaLab WMS – Fatura (Invoice) Modelleri
Warehouse şeması.

Bir fatura = BİR müşterinin, faturalandırma anında sevk bekleyen (statü 127) cihazlarının
tamamı. Müşteri bazında kesilir çünkü her müşterinin cari hesabı ayrıdır.

Fatura kesildiği anda üretilen CSV dosyasının içeriği `csv_content` alanında SAKLANIR ve
"Dosya İndir" her zaman o kaydı verir - yeniden hesaplanmaz. Fiyat matrisleri sonradan
değişse bile kesilmiş fatura değişmez; mali belge budur.

Satır detayı `invoice_devices`'ta cihaz bazında tutulur (parça/işçilik/DGD kırılımıyla),
böylece "bu fatura nereden çıktı" sorusu dosyayı açmadan da cevaplanabilir.
"""

from sqlalchemy import (Column, String, Integer, Numeric, DateTime, Text,
                        ForeignKey, UniqueConstraint)
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime

from config.database import Base


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("invoice_no", name="uq_invoice_no"),
        {"schema": "warehouse"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Format: <müşteri kodu>-<yıl>-<4 haneli sıra>, ör. 001-2026-0001.
    # Sıra müşteri ve yıl bazında ilerler.
    invoice_no = Column(String(40), nullable=False)
    customer_code = Column(String(50), nullable=False)
    customer_name = Column(String(255), nullable=True)
    currency = Column(String(10), nullable=True)

    device_count = Column(Integer, nullable=False, default=0)
    parts_total = Column(Numeric(14, 2), nullable=False, default=0)
    labour_total = Column(Numeric(14, 2), nullable=False, default=0)
    dgd_total = Column(Numeric(14, 2), nullable=False, default=0)
    grand_total = Column(Numeric(14, 2), nullable=False, default=0)
    # Fiyatı bulunamayıp 0 olarak geçen kalem sayısı - faturayı kesen kişi uyarıldı,
    # ama sonradan "bu neden düşük" sorusuna cevap verebilmek için sayı saklanır.
    missing_price_count = Column(Integer, nullable=False, default=0)

    csv_content = Column(Text, nullable=True)

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class InvoiceDevice(Base):
    __tablename__ = "invoice_devices"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True),
                        ForeignKey("warehouse.invoices.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    imei_number = Column(String(50), nullable=True)
    service_id = Column(String(64), nullable=True)
    model = Column(String(255), nullable=True)
    flow = Column(String(100), nullable=True)

    # Faturalandığı ANDAKİ seviye. Sonradan parça eklenirse/çıkarılırsa bu değer
    # değişmez - fatura o günkü hâli belgeler.
    repair_level = Column(String(50), nullable=True)
    dgd_status = Column(String(50), nullable=True)

    parts_total = Column(Numeric(12, 2), nullable=False, default=0)
    labour_total = Column(Numeric(12, 2), nullable=False, default=0)
    dgd_fee = Column(Numeric(12, 2), nullable=False, default=0)
    grand_total = Column(Numeric(12, 2), nullable=False, default=0)
