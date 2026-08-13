import uuid
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from config.database import Base
from core.zaman import tr_now
import datetime

class RepairRecord(Base):
    """
    Alt Onarım İş Emri (Concurrent Repair) tablosu.
    Cihaz 109 statüsündeyken departmanlara eşzamanlı düşen parçalı iş emirleri.
    """
    __tablename__ = "repair_records"
    __table_args__ = {"schema": "warehouse"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_record_id = Column(String(255), nullable=False) # service_records veya work_orders FK id'si
    department_mission = Column(String(255), nullable=False) # Hangi mission'a atandi (BATTERY, L1 vb)

    # ONARIM ÜST KAYDI (warehouse.repairs). Bu tablodaki her satır bir PARÇADIR;
    # "Kasa Onarımı" gibi bir onarım, aynı cihaz + aynı görev grubundaki parçaların
    # bağlı olduğu üst kayıttır. Statü, teknisyen ataması ve bitiş testi sonucu
    # onarımın kendi alanlarıdır (bkz. WebBridge._ensure_repairs_table).
    # Geçiş sürerken bu kolon boş kalabilir; açılıştaki tarama bağsız satırları bağlar.
    repair_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Su anki statu (Orn: 1000 - Atanacak, 1001 - Atandi, 1002 - Tamamlandi)
    repair_result_type_code = Column(Integer, ForeignKey("warehouse.repair_result_type.code"), default=1000)
    # AŞAMA 4: parçanın YAŞAM DÖNGÜSÜ ekseni (warehouse.repair_part_status).
    # 2000 Aktif · 2001 Silindi · 2002 Muadille Değiştirildi · 2003 Yanlış Girildi.
    # "Listede mi" sorusunu kod değil repair_part_status.is_removed cevaplar.
    # Tedarik durumu (supply_status_code) ve onarım statüsü (repairs) AYRI eksenlerdir.
    part_status_code = Column(Integer, default=2000)
    
    # Secilen islem/garanti turleri (teknisyen secer veya sistem atar)
    operation_type_code = Column(String(255), nullable=True)
    warranty_code = Column(String(255), nullable=True) # IW veya OOW
    
    item_category = Column(String(255), nullable=True) # Arızalı parça kategorisi (Orn: Ti-Battery)
    part_item_code = Column(String(100), nullable=True) # warehouse.item/parts kodu (Demontaj ekranı "Parça" seçimi)
    item_fault_code = Column(String(255), nullable=True) # warehouse.item_fault kodu (Demontaj ekranı "Arıza Tespiti")
    supply_status_code = Column(String(255), ForeignKey("warehouse.item_supply_status.code"), nullable=True) # Depo Durum (Onarım Parçaları ekranı)
    supply_requested_by = Column(String(100), nullable=True) # Depo Durum'u en son değiştiren teknisyen (Depo > Parça Teslim ekranı)
    supply_requested_at = Column(DateTime, nullable=True) # Depo Durum'un en son değiştirildiği an

    # Teknisyene Atama (statü 1001 ile birlikte yazılır) - warehouse.users.username
    assigned_technician = Column(String(150), nullable=True) # Kayıt hangi teknisyene atandı
    assigned_by = Column(String(100), nullable=True) # Atamayı kim yaptı
    assigned_at = Column(DateTime, nullable=True) # Atama ne zaman yapıldı

    # MÜŞTERİ ONAYI - kayıt bazında. Cihaz Müşteri Onayı'ndan üretime geçtiğinde
    # (106->109 / 136->109) o cihazın açık kayıtlarının tamamına yazılır, bkz.
    # WebBridge._onay_bayragi_guncelle. Bir kez onaylanan kayıt için bir daha onay
    # istenmez; onaylanmamış kayıt ise kategorisi akışa uymuyorsa ya da cihazın
    # toplamı hedef limiti aşıyorsa depodan parça çekilmesini ve onarımın
    # tamamlanmasını engeller (bkz. WebBridge._onay_engeli).
    customer_approved = Column(Boolean, nullable=False, default=False)
    customer_approved_at = Column(DateTime, nullable=True)
    customer_approved_by = Column(String(100), nullable=True)

    notes = Column(Text, nullable=True)

    # K7: Türkiye yerel saati. Eskiden utcnow() ile Greenwich yazılıyordu; aynı
    # tablodaki SQL NOW() yazımlarıyla 3 saat uyuşmazlık oluşuyordu.
    created_at = Column(DateTime, default=tr_now)
    updated_at = Column(DateTime, default=tr_now, onupdate=tr_now)
    # Onarımın KAPANDIĞI an (1002 Tamamlandı / 1003 İptal). Kayıt yeniden açılırsa
    # temizlenir. updated_at "satıra son yazma" olduğu için kapanış zamanı ondan
    # okunamaz - depo durumu değişikliği gibi sonraki yazmalar damgayı ileri kaydırır.
    closed_at = Column(DateTime, nullable=True)
