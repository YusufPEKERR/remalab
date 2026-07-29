import uuid
from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base


class ServiceRequestItemCategory(Base):
    """MioCreate.xlsx -> ServiceRequestItemCategory. Hangi parça kategorisinde
    (item_category, örn. 'Battery', 'LCD') hangi servis talebi tiplerinin
    (service_request_type, örn. 'To repair', 'Battery only ') geçerli olduğunu
    ve bunun müşteri onayı gerektirip gerektirmediğini (is_customer_approved) tutar.
    Demontaj ekranındaki 'Arıza Tespiti' dropdown'unun kaynağıdır - seçilen parçanın
    item_category'sine göre filtrelenir."""
    __tablename__ = "service_request_item_category"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), nullable=True, unique=True)
    service_request_type = Column(String(255), nullable=True)
    item_category = Column(String(255), nullable=True)
    is_customer_approved = Column(Boolean, default=False)
    update = Column(Boolean, default=False)
