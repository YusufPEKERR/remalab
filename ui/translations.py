"""
RemaLab WMS - Çeviri / Translation Sistemi
İngilizce ve Türkçe dil desteği.
"""

from PySide6.QtCore import QObject, Signal


class TranslationManager(QObject):
    """Dil değişikliklerini yöneten singleton sınıf."""

    language_changed = Signal(str)

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._current_lang = "tr"  # Varsayılan Türkçe
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not self._initialized:
            super().__init__()
            self._initialized = True

    @property
    def current_language(self) -> str:
        return self._current_lang

    def set_language(self, lang: str):
        """Dili değiştir ('en' veya 'tr')."""
        if lang != self._current_lang and lang in ("en", "tr"):
            self._current_lang = lang
            self.language_changed.emit(lang)

    def t(self, key: str) -> str:
        """Çeviri anahtarına göre metni döndür."""
        translations = TRANSLATIONS.get(key, {})
        return translations.get(self._current_lang, key)


# Global instance
_tr_manager = None


def tr(key: str) -> str:
    """Kısa yol: Çeviri anahtarını çevir."""
    global _tr_manager
    if _tr_manager is None:
        _tr_manager = TranslationManager()
    return _tr_manager.t(key)


def get_translator() -> TranslationManager:
    """TranslationManager singleton'ını döndür."""
    global _tr_manager
    if _tr_manager is None:
        _tr_manager = TranslationManager()
    return _tr_manager


# ============================================================
#  ÇEVİRİ SÖZLÜĞÜ
# ============================================================
TRANSLATIONS = {
    # ---- App ----
    "app.title": {
        "en": "RemaLab - Warehouse Management System",
        "tr": "RemaLab - Depo Yönetim Sistemi",
    },
    "app.subtitle": {
        "en": "WAREHOUSE MANAGEMENT",
        "tr": "DEPO YÖNETİMİ",
    },
    # ---- Sidebar Sections ----
    "section.overview": {"en": "OVERVIEW", "tr": "GENEL BAKIŞ"},
    "section.warehouse": {"en": "WAREHOUSE", "tr": "DEPO"},
    "section.inventory": {"en": "INVENTORY", "tr": "ENVANTER"},
    "section.operations": {"en": "OPERATIONS", "tr": "OPERASYONLAR"},
    "section.quality": {"en": "QUALITY", "tr": "KALİTE"},
    "section.system": {"en": "SYSTEM", "tr": "SİSTEM"},
    # ---- Sidebar Modules ----
    "nav.dashboard": {"en": "Dashboard", "tr": "Kontrol Paneli"},
    "nav.warehouse": {"en": "Warehouse", "tr": "Depo"},
    "nav.locations": {"en": "Locations", "tr": "Lokasyonlar"},
    "nav.parts": {"en": "Parts", "tr": "Parçalar"},
    "nav.brands": {"en": "Brands", "tr": "Markalar"},
    "nav.phone_models": {"en": "Product List", "tr": "Ürün Listesi"},
    "nav.suppliers": {"en": "Suppliers", "tr": "Tedarikçiler"},
    "nav.waybill": {"en": "Waybill", "tr": "İrsaliye"},
    "nav.inbound": {"en": "Inbound", "tr": "Giriş"},
    "nav.outbound": {"en": "Outbound", "tr": "Çıkış"},
    "nav.putaway": {"en": "Putaway", "tr": "Yerleştirme"},
    "nav.picking": {"en": "Picking", "tr": "Toplama"},
    "nav.inventory": {"en": "Inventory", "tr": "Stok Sayım"},
    "nav.quality_control": {"en": "Quality Control", "tr": "Kalite Kontrol"},
    "nav.refurbishment": {"en": "Refurbishment", "tr": "Yenileme"},
    "nav.priority_matrix": {"en": "Priority Matrix", "tr": "Öncelik Matrisi"},
    "nav.reports": {"en": "Reports", "tr": "Raporlar"},
    "nav.users": {"en": "Users", "tr": "Kullanıcılar"},
    "nav.settings": {"en": "Settings", "tr": "Ayarlar"},
    # ---- Topbar ----
    "topbar.search": {
        "en": "Search parts, locations, orders...",
        "tr": "Parça, lokasyon, sipariş ara...",
    },
    "topbar.home": {"en": "Home", "tr": "Ana Sayfa"},
    "topbar.role_admin": {"en": "Admin", "tr": "Yönetici"},
    # ---- Common ----
    "common.save": {"en": "Save", "tr": "Kaydet"},
    "common.cancel": {"en": "Cancel", "tr": "İptal"},
    "common.loading": {"en": "Loading...", "tr": "Yükleniyor..."},
    # ---- Dashboard ----
    "dashboard.title": {"en": "Dashboard Overview", "tr": "Kontrol Paneli"},
    "dashboard.welcome": {
        "en": "Welcome back! Here's what's happening in your warehouse today.",
        "tr": "Tekrar hoş geldiniz! Bugün deponuzda neler olduğuna göz atın.",
    },
    "dashboard.total_parts": {"en": "Total Parts", "tr": "Toplam Parça"},
    "dashboard.total_stock": {"en": "Total Stock", "tr": "Toplam Stok"},
    "dashboard.low_stock": {"en": "Low Stock", "tr": "Düşük Stok"},
    "dashboard.todays_inbound": {"en": "Today's Inbound", "tr": "Bugünkü Giriş"},
    "dashboard.todays_outbound": {"en": "Today's Outbound", "tr": "Bugünkü Çıkış"},
    "dashboard.active_locations": {"en": "Active Locations", "tr": "Aktif Lokasyonlar"},
    "dashboard.recent_movements": {
        "en": "Recent Stock Movements",
        "tr": "Son Stok Hareketleri",
    },
    "dashboard.movements_subtitle": {
        "en": "Latest inventory movements across all locations",
        "tr": "Tüm lokasyonlardaki son envanter hareketleri",
    },
    "dashboard.view_all": {"en": "View All  →", "tr": "Tümünü Gör  →"},
    "dashboard.refresh": {"en": "🔄  Refresh", "tr": "🔄  Yenile"},
    "dashboard.db_error": {
        "en": "Database Connection Error",
        "tr": "Veritabanı Bağlantı Hatası",
    },
    "dashboard.details_title": {
        "en": "Detail View: {name}",
        "tr": "Detaylı Görünüm: {name}",
    },
    "table.part_id": {"en": "Part ID", "tr": "Parça ID"},
    "table.location_id": {"en": "Location ID", "tr": "Lokasyon ID"},
    "table.stock_quantity": {"en": "Stock Quantity", "tr": "Stok Miktarı"},
    # ---- Parts & Warehouse Page translations ----
    "parts.title": {"en": "Parts Management", "tr": "Parça Yönetimi"},
    "parts.subtitle": {
        "en": "Add, update or remove warehouse parts",
        "tr": "Depo parçalarını ekleyin, güncelleyin veya silin",
    },
    "parts.add_new": {"en": "＋ Add Part", "tr": "＋ Parça Ekle"},
    "parts.part_name": {"en": "Part Name", "tr": "Parça Adı"},
    "parts.search_placeholder": {"en": "Search parts...", "tr": "Parça ara..."},
    "parts.confirm_delete": {
        "en": "Are you sure you want to delete this part?",
        "tr": "Bu parçayı silmek istediğinize emin misiniz?",
    },
    "warehouse.title": {"en": "Warehouse Stock", "tr": "Depo Stok Durumu"},
    "warehouse.subtitle": {
        "en": "Monitor and transfer stock across warehouse locations",
        "tr": "Depo lokasyonlarındaki stokları takip edin ve transfer edin",
    },
    "warehouse.transfer_stock": {
        "en": "🔄 Transfer Stock",
        "tr": "🔄 Stok Transfer Et",
    },
    "warehouse.source_location": {"en": "Source Location", "tr": "Kaynak Lokasyon"},
    "warehouse.target_location": {"en": "Target Location", "tr": "Hedef Lokasyon"},
    "warehouse.transfer_quantity": {
        "en": "Quantity to Transfer",
        "tr": "Transfer Miktarı",
    },
    "warehouse.transfer_success": {
        "en": "Stock transferred successfully!",
        "tr": "Stok başarıyla transfer edildi!",
    },
    "warehouse.insufficient_stock": {
        "en": "Insufficient stock in source location!",
        "tr": "Kaynak lokasyonda yetersiz stok var!",
    },
    # ---- Locations Page Translations ----
    "locations.title": {"en": "Location Management", "tr": "Lokasyon Yönetimi"},
    "locations.subtitle": {
        "en": "Add, update or remove warehouse storage locations",
        "tr": "Depo raf ve depolama lokasyonlarını ekleyin, güncelleyin veya silin",
    },
    "locations.add_new": {"en": "＋ Add Location", "tr": "＋ Lokasyon Ekle"},
    "locations.location_name": {"en": "Location Name", "tr": "Lokasyon Adı"},
    "locations.search_placeholder": {
        "en": "Search locations...",
        "tr": "Lokasyon ara...",
    },
    "locations.confirm_delete": {
        "en": "Are you sure you want to delete this location?",
        "tr": "Bu lokasyonu silmek istediğinize emin misiniz?",
    },
    # ---- Inventory Page Translations ----
    "inventory.title": {"en": "Inventory Status", "tr": "Envanter Durumu"},
    "inventory.subtitle": {
        "en": "Comprehensive view of all stock details and status",
        "tr": "Tüm stok detaylarının ve durumlarının kapsamlı görünümü",
    },
    "table.item_code": {"en": "Item Code", "tr": "Ürün Kodu"},
    "table.barcode": {"en": "Barcode", "tr": "Barkod"},
    "table.brand_model": {"en": "Brand / Model", "tr": "Marka / Model"},
    "table.color": {"en": "Color", "tr": "Renk"},
    "table.product_family": {"en": "Product Family", "tr": "Ürün Ailesi"},
    "table.item_category": {"en": "Item Category", "tr": "Ürün Kategorisi"},
    "table.part_category": {"en": "Part Category", "tr": "Parça Kategorisi"},
    "table.stock_status": {"en": "Stock Status", "tr": "Stok Durumu"},
    # ---- Table Headers ----
    "table.movement_id": {"en": "Movement ID", "tr": "Hareket No"},
    "table.part_name": {"en": "Part Name", "tr": "Parça Adı"},
    "table.location": {"en": "Location", "tr": "Lokasyon"},
    "table.type": {"en": "Type", "tr": "Tür"},
    "table.quantity": {"en": "Quantity", "tr": "Miktar"},
    "table.date": {"en": "Date", "tr": "Tarih"},
    "table.time": {"en": "Time", "tr": "Zaman"},
    "table.status": {"en": "Status", "tr": "Durum"},
    # ---- Movement Types ----
    "movement.inbound": {"en": "Inbound", "tr": "Giriş"},
    "movement.outbound": {"en": "Outbound", "tr": "Çıkış"},
    "movement.transfer": {"en": "Transfer", "tr": "Transfer"},
    # ---- Status ----
    "status.completed": {"en": "Completed", "tr": "Tamamlandı"},
    "status.in_progress": {"en": "In Progress", "tr": "Devam Ediyor"},
    "status.pending": {"en": "Pending", "tr": "Beklemede"},
    # ---- Time ----
    "time.min_ago": {"en": "min ago", "tr": "dk önce"},
    "time.hour_ago": {"en": "hour ago", "tr": "saat önce"},
    "time.hours_ago": {"en": "hours ago", "tr": "saat önce"},
    # ---- Users Page ----
    "nav.users": {"en": "Users", "tr": "Kullanıcılar"},
    "users.title": {"en": "User Management", "tr": "Kullanıcı Yönetimi"},
    "users.add_user": {"en": "Add User", "tr": "Kullanıcı Ekle"},
    "users.edit_user": {"en": "Edit User", "tr": "Kullanıcı Düzenle"},
    "users.delete_user": {"en": "Delete User", "tr": "Kullanıcı Sil"},
    "users.register": {"en": "Register", "tr": "Kayıt Ol"},
    "users.username": {"en": "Username", "tr": "Kullanıcı Adı"},
    "users.email": {"en": "Email", "tr": "E-posta"},
    "users.password": {"en": "Password", "tr": "Şifre"},
    "users.password_placeholder": {
        "en": "Leave blank to keep same",
        "tr": "Değiştirmeyecekseniz boş bırakın",
    },
    "users.role": {"en": "Role", "tr": "Rol"},
    # ---- Settings / Database ----
    "settings.title": {"en": "Settings", "tr": "Ayarlar"},
    "settings.subtitle": {
        "en": "Manage application settings and database connections.",
        "tr": "Uygulama ayarlarını ve veritabanı bağlantılarını yönetin.",
    },
    "settings.general": {"en": "General", "tr": "Genel"},
    "settings.database": {"en": "Database", "tr": "Veritabanı"},
    "settings.appearance": {"en": "Appearance", "tr": "Görünüm"},
    "settings.language": {"en": "Language", "tr": "Dil"},
    "settings.language_desc": {
        "en": "Select application language",
        "tr": "Uygulama dilini seçin",
    },
    # Database management
    "db.title": {"en": "Database Connections", "tr": "Veritabanı Bağlantıları"},
    "db.subtitle": {
        "en": "Manage your database connections (PostgreSQL, MySQL, SQL Server)",
        "tr": "Veritabanı bağlantılarınızı yönetin (PostgreSQL, MySQL, SQL Server)",
    },
    "db.add_new": {"en": "＋  Add Connection", "tr": "＋  Bağlantı Ekle"},
    "db.connection_name": {"en": "Connection Name", "tr": "Bağlantı Adı"},
    "db.db_type": {"en": "Database Type", "tr": "Veritabanı Türü"},
    "db.host": {"en": "Host", "tr": "Sunucu"},
    "db.port": {"en": "Port", "tr": "Port"},
    "db.database_name": {"en": "Database Name", "tr": "Veritabanı Adı"},
    "db.username": {"en": "Username", "tr": "Kullanıcı Adı"},
    "db.password": {"en": "Password", "tr": "Şifre"},
    "db.test_connection": {"en": "Test Connection", "tr": "Bağlantıyı Test Et"},
    "db.save": {"en": "Save", "tr": "Kaydet"},
    "db.cancel": {"en": "Cancel", "tr": "İptal"},
    "db.delete": {"en": "Delete", "tr": "Sil"},
    "db.refresh": {"en": "Refresh", "tr": "Yenile"},
    "db.edit": {"en": "Edit", "tr": "Düzenle"},
    "db.connected": {"en": "Connected", "tr": "Bağlı"},
    "db.disconnected": {"en": "Disconnected", "tr": "Bağlı Değil"},
    "db.testing": {"en": "Testing...", "tr": "Test Ediliyor..."},
    "db.success": {"en": "Connection successful!", "tr": "Bağlantı başarılı!"},
    "db.failed": {"en": "Connection failed!", "tr": "Bağlantı başarısız!"},
    "db.no_connections": {
        "en": "No database connections configured yet.",
        "tr": "Henüz veritabanı bağlantısı yapılandırılmadı.",
    },
    "db.confirm_delete": {
        "en": "Are you sure you want to delete this connection?",
        "tr": "Bu bağlantıyı silmek istediğinize emin misiniz?",
    },
    "db.default_name": {"en": "My Database", "tr": "Veritabanım"},
    "db.active": {"en": "Active", "tr": "Aktif"},
    "db.set_active": {"en": "Set Active", "tr": "Aktif Yap"},
    "db.type_postgresql": {"en": "PostgreSQL", "tr": "PostgreSQL"},
    "db.type_mysql": {"en": "MySQL", "tr": "MySQL"},
    "db.type_mssql": {"en": "SQL Server", "tr": "SQL Server"},
    "db.driver_missing": {
        "en": "Required driver package is missing. Install:",
        "tr": "Gerekli sürücü paketi eksik. Kurun:",
    },
    # ---- Inbound Stock Entry Page Translations ----
    "inbound.title": {"en": "Inbound Stock Entry", "tr": "Yeni Stok Girişi"},
    "inbound.subtitle": {
        "en": "Record and list new inbound inventory stock entries",
        "tr": "Yeni envanter stok girişlerini listeleyin ve kaydedin",
    },
    "inbound.add_new": {"en": "＋ Add New Stock", "tr": "＋ Yeni Stok Ekle"},
    "inbound.unit_price": {"en": "Unit Price", "tr": "Birim Fiyat"},
    "inbound.total_cost": {"en": "Total Cost", "tr": "Toplam Maliyet"},
    "inbound.created_by": {"en": "Processed By", "tr": "İşlemi Yapan"},
    "inbound.date": {"en": "Entry Date", "tr": "Giriş Tarihi"},
    "inbound.unauthorized": {
        "en": "You are not authorized to view this page.",
        "tr": "Bu sayfayı görüntülemek için yetkiniz bulunmamaktadır.",
    },
    "inbound.barcode": {"en": "Barcode Scanner Input", "tr": "Barkod Okuyucu Girişi"},
    "inbound.barcode_error_title": {
        "en": "Product Not Found!",
        "tr": "Ürün Bulunamadı!",
    },
    "inbound.barcode_error_msg": {
        "en": "ERROR: Product Not Found!\nThis barcode is not registered in the system.\n\nDo you want to add this barcode as a NEW product?",
        "tr": "HATA: Ürün Bulunamadı!\nBu barkoda ait bir ürün sistemde kayıtlı değil.\n\nBu barkodu YENİ ÜRÜN olarak hızlıca eklemek ister misiniz?",
    },
    "inbound.quick_add_title": {"en": "Quick Add Product", "tr": "Hızlı Ürün Ekleme"},
    # ---- Reports Page Translations ----
    "reports.title": {"en": "Warehouse Movement Report", "tr": "Depo Hareket Raporu"},
    "reports.subtitle": {
        "en": "Summary of the latest warehouse inbound and outbound movements",
        "tr": "Son depo giriş ve çıkış işlemlerinin özet listesi",
    },
    # ---- Outbound Stock Entry Page Translations ----
    "outbound.title": {"en": "Outbound Stock Entry", "tr": "Depo Çıkış Modülü"},
    "outbound.subtitle": {
        "en": "Record and list inventory outbound stock entries",
        "tr": "Depodan envanter çıkış işlemlerini kaydedin ve listeleyin",
    },
    "outbound.add_new": {"en": "＋ Create Outbound", "tr": "＋ Stok Çıkışı Yap"},
    "outbound.unauthorized": {
        "en": "You are not authorized to view this page.",
        "tr": "Bu sayfayı görüntülemek için yetkiniz bulunmamaktadır.",
    },
    "outbound.date": {"en": "Outbound Date", "tr": "Çıkış Tarihi"},
    "outbound.destination": {
        "en": "Destination/Client",
        "tr": "Gönderilen Yer / Alıcı",
    },
    "outbound.destination_label": {"en": "Destination", "tr": "Alıcı/Müşteri"},
    "outbound.insufficient_stock": {
        "en": "Error: Insufficient stock at the selected location!",
        "tr": "Hata: Seçilen lokasyonda yeterli stok bulunmuyor!",
    },
    "outbound.success": {
        "en": "Outbound stock transaction completed successfully!",
        "tr": "Stok çıkış işlemi başarıyla tamamlandı!",
    },
    "excel.import": {"en": "📥 Import Excel", "tr": "📥 Excel'den İçe Aktar"},
    "excel.export": {"en": "📤 Export Excel", "tr": "📤 Excel'e Dışa Aktar"},
    "excel.mapping_title": {
        "en": "Excel Column Mapping",
        "tr": "Excel Sütun Eşleştirme",
    },
    "excel.select_file": {"en": "Select Excel File", "tr": "Excel Dosyası Seçin"},
    "excel.db_column": {"en": "Database Column", "tr": "Veritabanı Sütunu"},
    "excel.excel_column": {"en": "Excel Header", "tr": "Excel Sütun Başlığı"},
    "excel.success": {
        "en": "Data successfully imported!",
        "tr": "Veriler başarıyla içe aktarıldı!",
    },
    "excel.error": {
        "en": "An error occurred during Excel operation:",
        "tr": "Excel işlemi sırasında bir hata oluştu:",
    },
    # ---- Local Database / File Management ----
    "local.title": {
        "en": "Local Database / SQL Files",
        "tr": "Lokal Veritabanı / SQL Dosyaları",
    },
    "local.subtitle": {
        "en": "Manage local SQLite database files, SQL scripts, and data folders",
        "tr": "Lokal SQLite veritabanı dosyalarını, SQL scriptlerini ve veri klasörlerini yönetin",
    },
    "local.add_db_file": {
        "en": "＋  Add DB / SQL File",
        "tr": "＋  DB / SQL Dosyası Ekle",
    },
    "local.create_new_db": {
        "en": "＋  Create New Database",
        "tr": "＋  Yeni Veritabanı Oluştur",
    },
    "local.select_folder": {"en": "📁  Select Folder", "tr": "📁  Klasör Seç"},
    "local.browse": {"en": "Browse...", "tr": "Gözat..."},
    "local.file_path": {"en": "File Path", "tr": "Dosya Yolu"},
    "local.folder_path": {"en": "Folder Path", "tr": "Klasör Yolu"},
    "local.db_name": {"en": "Database Name", "tr": "Veritabanı Adı"},
    "local.db_type": {"en": "Type", "tr": "Tür"},
    "local.db_size": {"en": "Size", "tr": "Boyut"},
    "local.last_modified": {"en": "Last Modified", "tr": "Son Değişiklik"},
    "local.no_files": {
        "en": "No local database files added yet.",
        "tr": "Henüz lokal veritabanı dosyası eklenmedi.",
    },
    "local.import_db": {"en": "Import Database", "tr": "Veritabanı İçe Aktar"},
    "local.export_db": {"en": "Export Database", "tr": "Veritabanı Dışa Aktar"},
    "local.open_folder": {"en": "Open Folder", "tr": "Klasörü Aç"},
    "local.remove": {"en": "Remove", "tr": "Kaldır"},
    "local.confirm_remove": {
        "en": "Are you sure you want to remove this file from the list?",
        "tr": "Bu dosyayı listeden kaldırmak istediğinize emin misiniz?",
    },
    "local.file_not_found": {
        "en": "File not found!",
        "tr": "Dosya bulunamadı!",
    },
    "local.file_added": {
        "en": "File added successfully!",
        "tr": "Dosya başarıyla eklendi!",
    },
    "local.db_created": {
        "en": "Database created successfully!",
        "tr": "Veritabanı başarıyla oluşturuldu!",
    },
    "local.select_db_file": {
        "en": "Select Database File",
        "tr": "Veritabanı Dosyası Seçin",
    },
    "local.select_save_location": {
        "en": "Select Save Location",
        "tr": "Kayıt Konumunu Seçin",
    },
    "local.select_data_folder": {
        "en": "Select Data Folder",
        "tr": "Veri Klasörünü Seçin",
    },
    "local.data_folders": {"en": "Data Folders", "tr": "Veri Klasörleri"},
    "local.data_folders_subtitle": {
        "en": "Folders used for backups, exports and imports",
        "tr": "Yedekleme, dışa aktarma ve içe aktarma için kullanılan klasörler",
    },
    "local.no_folders": {
        "en": "No data folders configured yet.",
        "tr": "Henüz veri klasörü yapılandırılmadı.",
    },
    "local.add_folder": {"en": "＋  Add Folder", "tr": "＋  Klasör Ekle"},
    "local.folder_type_backup": {"en": "Backup", "tr": "Yedekleme"},
    "local.folder_type_export": {"en": "Export", "tr": "Dışa Aktarma"},
    "local.folder_type_import": {"en": "Import", "tr": "İçe Aktarma"},
    "local.folder_type_data": {"en": "Data", "tr": "Veri"},
    "local.tables": {"en": "Tables", "tr": "Tablolar"},
    "local.records": {"en": "Records", "tr": "Kayıtlar"},
    # ---- Settings Tabs ----
    "settings.local_db": {"en": "Local DB", "tr": "Lokal DB"},
    "local.db_copied": {
        "en": "File successfully copied to project database folder!",
        "tr": "Dosya proje database klasörüne başarıyla kopyalandı!",
    },
    "dashboard.local_db_status": {
        "en": "Local Database / SQL Files Status",
        "tr": "Lokal Veritabanı / SQL Dosyaları Durumu",
    },
    "dashboard.total_db_files": {
        "en": "Database Files",
        "tr": "Veritabanı Dosyaları",
    },
    "dashboard.total_sql_files": {
        "en": "SQL Script Files",
        "tr": "SQL Script Dosyaları",
    },
    "dashboard.total_db_size": {
        "en": "Total Local DB Size",
        "tr": "Toplam Lokal DB Boyutu",
    },
    "dashboard.active_local_db": {
        "en": "Active Local Database",
        "tr": "Aktif Lokal Veritabanı",
    },
    # ---- Placeholder ----
    "placeholder.title": {"en": "Under Development", "tr": "Geliştirme Aşamasında"},
    "placeholder.subtitle": {
        "en": "This module is under development",
        "tr": "Bu modül geliştirme aşamasındadır",
    },
}
