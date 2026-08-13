"""Sistemdeki TEK zaman kaynağı.

K7: Zaman damgaları eskiden iki ayrı saatten yazılıyordu. Python tarafı
datetime.utcnow() ile Greenwich saatini, SQL tarafı NOW() ile Türkiye saatini
yazıyordu - arada 3 saat var. repair_records / repairs tablolarındaki zaman
kolonları saat dilimsiz (TIMESTAMP) olduğu için değerin hangi saate ait olduğu
kayıtta durmuyor; AYNI kolon (assigned_at, closed_at, supply_requested_at)
hangi ekrandan yazıldığına göre iki farklı saat taşıyabiliyordu. Sonuç: ekranda
3 saat ileri görünen tarihler, 3 saat şişen onarım süreleri ve "en son
güncellenen" sıralamasında yanlış sıra.

KURAL: Python tarafındaki her zaman damgası tr_now()'dan alınır. SQL tarafında
NOW() kullanılmaya devam edilir - veritabanı sunucusunun saat dilimi
Europe/Istanbul olduğu için ikisi aynı saati verir.

Bu modül web_bridge'e değil, models'e de import edilebilsin diye ayrı duruyor.
"""
import datetime as _dt

# Türkiye kalıcı olarak UTC+3'tür (2016'dan beri yaz saati uygulaması yok), bu
# yüzden sabit offset güvenli ve tzdata bağımlılığı gerektirmez.
TR_TZ = _dt.timezone(_dt.timedelta(hours=3))


def tr_now():
    """Türkiye yerel saati, saat dilimsiz (naive).

    datetime.now() yerine sabit +03 offset kullanılır: uygulamayı çalıştıran
    bilgisayarın saat dilimi yanlış ayarlıysa bile veritabanıyla aynı saat yazılır."""
    return _dt.datetime.now(TR_TZ).replace(tzinfo=None)


def fmt_tr_datetime(dt, with_time=True):
    """Bir datetime'ı Türkiye yerel saatine çevirip formatlar. None -> ''.

    Saat dilimsiz (naive) değerler ZATEN Türkiye yerel saatidir (bkz. tr_now) -
    üzerine offset EKLENMEZ. Eskiden naive değerler UTC kabul edilip +3 saat
    ekleniyordu; Türkiye saatiyle yazılmış kayıtlarda bu ikinci bir +3 demekti
    ve akşam 21:00'deki işlem ekranda ertesi günün 00:00'ı olarak görünüyordu.
    Saat dilimli (TIMESTAMPTZ) değerler Türkiye saatine çevrilir."""
    if not dt:
        return ""
    if dt.tzinfo is not None:
        dt = dt.astimezone(TR_TZ)
    return dt.strftime("%d.%m.%Y %H:%M" if with_time else "%d.%m.%Y")
