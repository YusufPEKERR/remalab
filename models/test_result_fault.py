import uuid
import datetime
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base


class TestResultFault(Base):
    """
    Ara Test / Son Test ekranlarında "Test Başarısız" olarak işlenen cihazların
    hatalı parça / hata kaydı. Her hatalı parça-hata çifti ayrı bir satırdır;
    aynı test gönderimi için en fazla 10 satır girilebilir (frontend tarafında sınırlanır).
    """
    __tablename__ = "test_result_faults"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_id = Column(Integer, nullable=False)  # batch_entries.id
    imei_number = Column(String(100), nullable=True)
    internal_id = Column(String(100), nullable=True)
    part_category = Column(String(255), nullable=True)  # Hatalı Parça
    fault_text = Column(String(255), nullable=True)  # Hata
    description = Column(String(1000), nullable=True)  # Açıklama
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
