# RemaLab WMS - Geliştirici Dokümantasyonu

RemaLab Warehouse Management System (Depo Yönetim Sistemi), endüstriyel standartlarda geliştirilmiş, yüksek performanslı ve güvenilir bir stok ve donanım yönetim platformudur.

Bu dokümantasyon, projenin **API mimarisini**, **Servis Katmanlarını (Service Layer)** ve **Veri Modellerini** detaylandırmakta olup, üçüncü parti yazılımların ve geliştiricilerin RemaLab WMS ekosistemine entegre olmasını sağlamak amacıyla hazırlanmıştır.

---

## Mimari Bakış (Architecture Overview)

RemaLab WMS, ölçeklenebilir ve modüler bir mimari üzerine inşa edilmiştir:

- **PySide6 UI**: Son kullanıcılar ve depo görevlileri için geliştirilmiş, yüksek performanslı ve asenkron masaüstü arayüzü.
- **FastAPI**: Dış sistemlerin (Mobil, Web, ERP) RemaLab'e güvenle bağlanmasını sağlayan, Swagger UI destekli modern RESTful API katmanı.
- **SQLAlchemy (ORM)**: PostgreSQL veya SQLite gibi veritabanlarıyla güvenli, Object-Relational Mapping prensiplerine uygun veri erişim katmanı.
- **Pydantic**: API istek ve cevaplarının kesin tiplerle (strict typing) doğrulanmasını sağlayan yapı.

## Hızlı Başlangıç (Quick Start)

### 1. Gereksinimlerin Yüklenmesi
Sistemi yerel ortamda çalıştırmak için gerekli Python bağımlılıklarını kurun:
```bash
pip install -r requirements.txt
```

### 2. API Sunucusunun Başlatılması
Geliştirme veya entegrasyon testleri için FastAPI sunucusunu ayağa kaldırın:
```bash
uvicorn api.main:app --reload
```
API başarılı bir şekilde başlatıldığında, interaktif API dokümantasyonuna (Swagger) şu adresten erişebilirsiniz:
👉 **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

---

*Detaylı teknik referanslar ve servis metotları için soldaki menüden "API Referansı" sekmesine geçiş yapabilirsiniz.*
