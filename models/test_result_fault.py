import uuid
import datetime
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base
from core.zaman import tr_now


class TestResultFault(Base):
    """
    Ara Test / Son Test ekranlarında "Test Başarısız" olarak işlenen cihazların
    hatalı parça / hata kaydı. Her test gönderimi tek bir satırdır; en fazla
    10 hatalı parça-hata çifti sabit kolonlarda tutulur (frontend 10 ile sınırlar).
    """
    __tablename__ = "test_result_faults"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_id = Column(Integer, nullable=False)  # batch_entries.id
    imei_number = Column(String(100), nullable=True)
    internal_id = Column(String(100), nullable=True)
    description = Column(String(1000), nullable=True)  # Açıklama

    hatali_parca1 = Column(String(255), nullable=True)
    hata1 = Column(String(255), nullable=True)
    hatali_parca2 = Column(String(255), nullable=True)
    hata2 = Column(String(255), nullable=True)
    hatali_parca3 = Column(String(255), nullable=True)
    hata3 = Column(String(255), nullable=True)
    hatali_parca4 = Column(String(255), nullable=True)
    hata4 = Column(String(255), nullable=True)
    hatali_parca5 = Column(String(255), nullable=True)
    hata5 = Column(String(255), nullable=True)
    hatali_parca6 = Column(String(255), nullable=True)
    hata6 = Column(String(255), nullable=True)
    hatali_parca7 = Column(String(255), nullable=True)
    hata7 = Column(String(255), nullable=True)
    hatali_parca8 = Column(String(255), nullable=True)
    hata8 = Column(String(255), nullable=True)
    hatali_parca9 = Column(String(255), nullable=True)
    hata9 = Column(String(255), nullable=True)
    hatali_parca10 = Column(String(255), nullable=True)
    hata10 = Column(String(255), nullable=True)

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=tr_now)
