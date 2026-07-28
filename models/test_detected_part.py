import uuid
import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base


class TestDetectedPart(Base):
    """
    Test aşamasında (QAC) tespit edilen, onarımda beklenen (planlı) parçalar.
    Demontaj Teknisyeni ekranındaki "Test: Sorun Tespit Edilen Parçalar" panelinin kaynağı.
    Bu satırları şu an hiçbir ekran yazmıyor (QAC test ekranı henüz yok) — okuma ucu hazır,
    yazma ucu QAC ekranı yapıldığında eklenecek.
    """
    __tablename__ = "test_detected_parts"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_ref = Column(String(255), nullable=False)  # repair_records.service_record_id ile aynı desen (IMEI ya da work_order_id)
    symptom_code = Column(String(255), nullable=True)
    part_category = Column(String(255), nullable=True)
    part_item_code = Column(String(100), nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
