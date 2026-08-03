import uuid
import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean, func
from config.database import Base


class PhonecheckTestResult(Base):
    """
    Phonecheck cihaz test sonuçlarının yerel yansıması.
    Normalde Phonecheck cloud API'sinden (GetAllDevices) çekilerek doldurulur;
    is_manual=True olan satırlar ise doğrudan uygulama içinden (örn. Son Test
    ekranında "Test Başarılı"/"Test Başarısız") elle işlenmiş kayıtlardır.
    """
    __tablename__ = "phonecheck_test_results"
    __table_args__ = {"schema": "warehouse"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    imei = Column(String(100), nullable=False)
    # service_statu_map.code formatinda test adimi: "103_104", "125_109" ...
    test_stage = Column(String(100), nullable=False)
    test_type = Column(String(255), nullable=True)
    test_start_time = Column(String(50), nullable=True)
    test_end_time = Column(String(50), nullable=True)
    station_id = Column(String(100), nullable=True)
    working = Column(String(20), nullable=True)
    passed = Column(Text, nullable=True)
    failed = Column(Text, nullable=True)
    pending = Column(Text, nullable=True)
    model = Column(String(255), nullable=True)
    memory = Column(String(100), nullable=True)
    serial = Column(String(100), nullable=True)
    color = Column(String(100), nullable=True)
    grade = Column(String(50), nullable=True)
    version = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    battery_cycle = Column(Integer, nullable=True)
    battery_health_percentage = Column(Integer, nullable=True)
    grading_results = Column(Text, nullable=True)
    # Phonecheck "Parts" alaninin HAM JSON'u:
    #   {"Remarks":"Not Genuine","Data":[{"name":"Battery","Status":"Not Genuine",...}, ...]}
    # Kritik parca orijinallik kontrolu (Ana Kamera / Batarya / Eski Pil) bundan turetilir,
    # bkz. phonecheck_service.parse_critical_parts. Ham hali saklanir cunku Phonecheck
    # ileride yeni parca satirlari eklerse eski kayitlardan da okunabilsin.
    parts = Column(Text, nullable=True)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    attempt_no = Column(Integer, nullable=True)
    is_manual = Column(Boolean, default=False)
    manual_reason = Column(Text, nullable=True)
    manual_entered_by = Column(String(100), nullable=True)
