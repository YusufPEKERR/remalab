from sqlalchemy import Column, Integer, String, Text, DateTime, func
from config.database import Base


class BatchEntryStatuHistory(Base):
    """Bir cihazın (batch_entries satırı) her statü geçişini kalıcı olarak kaydeder.
    batch_entries.statu_code üzerine yazıldığı için eski değerler kayboluyordu; bu tablo
    Servis > Durum sekmesindeki "Statü Geçmişi" için tam/eksiksiz bir iz tutar.

    Kayıt bir geçiş NOKTASIDIR: cihaz old_statu_code'dan new_statu_code'a geçtiğinde bir
    satır düşer. batch_entry_id her zaman set edilir; imei geriye dönük IMEI bazlı arama
    (eski kayıtlar, phonecheck eşleşmesi) kolaylığı için ayrıca tutulur."""
    __tablename__ = 'batch_entry_statu_history'
    __table_args__ = {'schema': 'warehouse'}

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_entry_id = Column(Integer, nullable=True, index=True)
    imei = Column(String(100), nullable=True, index=True)
    old_statu_code = Column(Integer, nullable=True)
    new_statu_code = Column(Integer, nullable=False)
    staff_name = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
