"""
RemaLab WMS – FlowDgdMapping (Flow -> DGD İşçilik Kodu) Modeli
Warehouse şeması.

İş Kuralı: batch_entries.flow değeri, Demontaj ekranında cihaza otomatik eklenecek
DGD işçilik kodunu (warehouse.parts, item_category='DGD_LABOR') 1:1 belirler.
"""

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime

from config.database import Base


class FlowDgdMapping(Base):
    __tablename__ = "flow_dgd_mapping"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flow_code = Column(String(100), unique=True, nullable=False)
    dgd_item_code = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
