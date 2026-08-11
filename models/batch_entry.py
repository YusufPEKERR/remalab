from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base

class BatchEntry(Base):
    __tablename__ = 'batch_entries'
    __table_args__ = {'schema': 'warehouse'}

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_no = Column(String(100), nullable=True)
    customer_name = Column(String(255), nullable=True)
    imei_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    internal_id = Column(String(100), nullable=True)
    batch_no = Column(String(100), nullable=True)
    service_id = Column(String(100), nullable=True)
    brand = Column(String(100), nullable=True)
    product_family = Column(String(255), nullable=True)
    product_category = Column(String(50), nullable=True)
    product_full_name = Column(String(255), nullable=True)
    receive_grade = Column(String(20), nullable=True)
    statu_update_time = Column(DateTime(timezone=True), nullable=True)
    model = Column(String(255), nullable=True)
    gb = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    unit_price = Column(Numeric(12, 2), default=0.00)
    currency = Column(String(10), default='EUR')
    is_success = Column(Boolean, default=False)
    created_by = Column(String(100), default='io')
    defects = Column(Text, nullable=True)
    screen_test = Column(String(100), nullable=True)
    power_test = Column(String(100), nullable=True)
    flow = Column(String(100), default='Refurbish')
    statu_code = Column(Integer, default=100)
    # Cihaz ONARILMADAN müşteriye iade ediliyor mu?
    # True olur : müşteri onayı/red ekranında RED geldiğinde (106->124, 136->124)
    # False olur: cihaz üretime (109) yeniden katıldığında - iade kararı geri alınmış olur
    # Faturada "full functional değil" sayılmanın ikinci yoludur: tüm onarımların iptal
    # edilmesi gerekmez, parçalar takılıp faturalanmış olsa da cihaz iade sayılabilir.
    repair_is_cancelled = Column(Boolean, nullable=False, default=False)
    service_id = Column(UUID(as_uuid=True), nullable=True)  # bkz. WebBridge._ensure_service_id_columns
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

