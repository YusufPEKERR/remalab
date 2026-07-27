"""
RemaLab WMS – Staff (Personel) Modeli
Organization şeması.

Mevcut warehouse.users tablosuyla birleştirilmiş, genişletilmiş personel modeli.
Personel-görev ilişkisi: 5 görev slotu (mission1-5)
Amir hiyerarşisi: team_leader, operation_manager, administrative_manager
"""

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid

from config.database import Base


class Staff(Base):
    """Personel tanımı – login bilgileri ve görev atamaları."""
    __tablename__ = "staff"
    __table_args__ = {"schema": "organization"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_name = Column(String(255), nullable=True, unique=False)
    short_name = Column(String(255), nullable=False)
    account_enabled = Column(Boolean, nullable=False, default=True)
    use_mio = Column(Boolean, nullable=False, default=False)
    account_type = Column(
        String(100), nullable=True,
        comment="STAFF, DEVELOPER, TEC_L3REPAIR, TEC_CASE, QAC, LOG_P, vb."
    )

    # Login bilgileri (eski users tablosundan taşınan)
    password_hash = Column(String(255), nullable=True)
    tc_no = Column(String(100), nullable=True, unique=True)
    role = Column(String(50), nullable=True, default="Teknisyen")

    # Görev atamaları – Mission code referansları (en fazla 5)
    mission1 = Column(String(100), nullable=True, comment="Birincil görev kodu")
    mission2 = Column(String(100), nullable=True, comment="İkincil görev kodu")
    mission3 = Column(String(100), nullable=True, comment="Üçüncül görev kodu")
    mission4 = Column(String(100), nullable=True, comment="Dördüncü görev kodu")
    mission5 = Column(String(100), nullable=True, comment="Beşinci görev kodu")

    # Amir hiyerarşisi (isim bazlı – mevcut yapıyla uyumlu)
    team_leader = Column(
        String(255), nullable=True,
        comment="1. Amir – Takım Lideri (shortName)"
    )
    operation_manager = Column(
        String(255), nullable=True,
        comment="2. Amir – Operasyon Yöneticisi (shortName)"
    )
    administrative_manager = Column(
        String(255), nullable=True,
        comment="3. Amir – İdari Yönetici (shortName)"
    )

    # Geçerlilik tarihleri
    valid_from_time = Column(DateTime, nullable=True)
    valid_to_time = Column(DateTime, nullable=True)

    @property
    def is_active(self) -> bool:
        """Hesap etkin ve MIO kullanıyor mu?"""
        return self.account_enabled and self.use_mio

    @property
    def mission_codes(self) -> list:
        """Atanmış görev kodlarını liste olarak döndürür."""
        codes = []
        for slot in [self.mission1, self.mission2, self.mission3,
                     self.mission4, self.mission5]:
            if slot:
                codes.append(slot)
        return codes
