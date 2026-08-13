"""Phonecheck entegrasyonu - tek giris noktasi.

Tasarim:
  * Test asamasi (test_stage) her zaman service_statu_map.code formatindadir:
    "103_104", "125_109" gibi. Boylece yeni bir test adimi tanimlandiginda
    kod degisikligi gerekmez, statu matrisinden kendiliginde turer.
  * Phonecheck sonucu service_test_result_type kodlarina cevrilir
    (Pass1 / Fail1 / None=test henuz bitmemis). Bu kodlar MioCreate.xlsx'ten
    seed'lenen isin kendi referans verisidir ve StateMachineService.execute_transition
    tarafindan kullanilir.
  * Cihaz Phonecheck'te bulunamazsa zorunlu aciklamali manuel giris yapilir.
"""
import os
from typing import Dict, Any, Optional

import requests
from sqlalchemy.orm import Session

from models.phonecheck_test_result import PhonecheckTestResult

# Tekil cihaz sorgusu: IMEI veya Seri Numarasi ile calisir, cihaz yoksa 404 doner.
# Toplu listeye (GetAllDevices) gore guvenilirdir - eski cihazlar da bulunur.
PHONECHECK_DEVICE_URL = "https://clientapiv2.phonecheck.com/cloud/CloudDB/GetDeviceInfo"
# Toplu liste (raporlama/export amacli)
PHONECHECK_URL = "https://clientapiv2.phonecheck.com/cloud/CloudDB/v2/GetAllDevices"
PHONECHECK_USERNAME = "out1"

# Ayni test adiminda bir cihaz icin izin verilen basarisiz deneme sayisi

# Phonecheck API alani -> phonecheck_test_results kolonu
FIELD_MAP = {
    "test_type": "Type",
    "test_start_time": "StartTime",
    "test_end_time": "EndTime",
    "station_id": "StationID",
    "working": "Working",
    "passed": "Passed",
    "failed": "Failed",
    "pending": "Pending",
    "model": "Model",
    "memory": "Memory",
    "serial": "Serial",
    "color": "Color",
    "grade": "Grade",
    "version": "Version",
    "notes": "Notes",
    "battery_cycle": "BatteryCycle",
    "battery_health_percentage": "BatteryHealthPercentage",
    "grading_results": "GradingResults",
    "parts": "Parts",
}

INT_COLUMNS = ("battery_cycle", "battery_health_percentage")

# ── Kritik parca orijinallik kontrolu ────────────────────────────────────────
# Phonecheck "Parts" alani parca parca orijinallik bilgisi doner:
#   {"Remarks":"Not Genuine",
#    "Data":[{"name":"Battery","Status":"Not Genuine","FactorySerial":...,"reason":...}, ...]}
# Ornek cihazda gorulen isimler: Serial Number, Main Board, Battery, Front Camera,
# Back Camera, Lcd, Lidar Sensor.
#
# Takip edilen 3 kritik parca ve Phonecheck'te karsilik gelebilecek adlar. Eslesme
# TAM AD uzerinden yapilir, "icinde geciyor mu" diye BAKILMAZ: "battery" alt dizgesi
# "Old Battery"yi de yakalar ve iki kritik parca birbirine karisirdi.
CRITICAL_PARTS = (
    ("main_camera", "Ana Kamera",    ("back camera", "main camera", "rear camera")),
    ("battery",     "Batarya / Pil", ("battery",)),
    ("old_battery", "Eski Pil",      ("old battery", "previous battery", "eski pil")),
)

GENUINE_STATUS = "genuine"
NOT_GENUINE_STATUS = "not_genuine"
UNKNOWN_STATUS = "unknown"

STATUS_LABELS = {
    GENUINE_STATUS: "Orijinal",
    NOT_GENUINE_STATUS: "Orijinal Değil",
    UNKNOWN_STATUS: "Belirtilmemiş",
}


def _normalize_part_name(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _normalize_status(value) -> str:
    """Phonecheck Status metnini uc duruma indirger.
    Bos/eksik deger 'unknown'dir - 'orijinal degil' ile ayni sey DEGILDIR, cunku
    Phonecheck bazi parcalari (ornekte Lidar Sensor) hic degerlendirmeden bos birakiyor."""
    s = _normalize_part_name(value)
    if not s:
        return UNKNOWN_STATUS
    if s in ("not genuine", "nongenuine", "non genuine", "not-genuine", "fake"):
        return NOT_GENUINE_STATUS
    if s == "genuine":
        return GENUINE_STATUS
    # Beklenmedik bir metin geldiginde "orijinal" demek yerine bilinmiyor sayilir.
    return UNKNOWN_STATUS


def _load_parts(parts_raw):
    """Ham Parts degerini (JSON metni ya da cozulmus nesne) (data_listesi, remarks)
    ikilisine cevirir. Bozuk/eksik veride patlamaz, bos liste doner."""
    import json as _json

    data = []
    remarks = ""
    if parts_raw:
        try:
            parsed = _json.loads(parts_raw) if isinstance(parts_raw, str) else parts_raw
            if isinstance(parsed, dict):
                remarks = str(parsed.get("Remarks") or "")
                data = parsed.get("Data") or []
            elif isinstance(parsed, list):
                data = parsed
        except (ValueError, TypeError):
            data = []
    return [d for d in data if isinstance(d, dict)], remarks


def parse_all_parts(parts_raw):
    """Phonecheck'in bildirdigi TUM parcalari normalize edilmis durumlariyla doner
    (yalnizca 3 kritik parca degil). Servis ekranindaki "Parts" sutununun kaynagi.
    Ikinci deger: genel Remarks ozeti."""
    data, remarks = _load_parts(parts_raw)
    items = []
    for item in data:
        status = _normalize_status(item.get("Status"))
        items.append({
            "name": str(item.get("name") or "").strip() or "(isimsiz)",
            "status": status,
            "statusLabel": STATUS_LABELS[status],
        })
    return items, remarks


def parse_critical_parts(parts_raw):
    """Ham Parts JSON'undan 3 kritik parcanin orijinallik durumunu cikarir.

    Her zaman UC eleman doner - parca Phonecheck ciktisinda hic yoksa da satir
    'unknown' olarak yerinde durur, arayuzde gri gorunur. Veri hic yoksa
    (kayit eski, Parts sutunu bos) yine ucu de 'unknown' doner.
    Ikinci deger: Phonecheck'in genel Remarks ozeti (ornek: "Not Genuine")."""
    data, remarks = _load_parts(parts_raw)

    by_name = {}
    for item in data:
        if isinstance(item, dict):
            by_name[_normalize_part_name(item.get("name"))] = item

    result = []
    for key, label, aliases in CRITICAL_PARTS:
        found = next((by_name[a] for a in aliases if a in by_name), None)
        status = _normalize_status(found.get("Status")) if found else UNKNOWN_STATUS
        result.append({
            "key": key,
            "label": label,
            "status": status,
            "statusLabel": STATUS_LABELS[status],
            # Hangi Phonecheck satirindan geldigini ve nedenini de tasiriz;
            # arayuz bunu tooltip'te gosterip "neden kirmizi" sorusunu cevaplar.
            "sourceName": (found or {}).get("name") or "",
            "reason": (found or {}).get("reason") or (found or {}).get("notice") or "",
        })
    return result, remarks


def get_api_key() -> Optional[str]:
    """API anahtarini .env'den okur.
    Iki isimlendirme de desteklenir (PHONECHECK_API_KEY / PHONECHECK_APIKEY),
    cunku projede her ikisi de kullanilmisti."""
    return os.getenv("PHONECHECK_API_KEY") or os.getenv("PHONECHECK_APIKEY")


def get_username() -> str:
    return os.getenv("PHONECHECK_USERNAME") or PHONECHECK_USERNAME

# Manuel doldurmada kullaniciya sunulan alanlar
MANUAL_FIELDS = ["working", "grade", "model", "memory", "serial", "color", "notes"]


class PhonecheckService:
    def __init__(self, db: Session):
        self.db = db

    # --- Asama / sonuc cevrimi ----------------------------------------------

    @staticmethod
    def build_stage(current_statu_code, target_statu_code) -> str:
        """Statu gecisini test asamasi koduna cevirir: (103, 104) -> "103_104".
        service_statu_map.code ile ayni formattir."""
        return f"{current_statu_code}_{target_statu_code}"

    @staticmethod
    def _has_items(value) -> bool:
        if value is None:
            return False
        if isinstance(value, (list, tuple)):
            return len(value) > 0
        if isinstance(value, str):
            return value.strip() not in ("", "0", "[]")
        return bool(value)

    @classmethod
    def to_test_result_code(cls, device: Dict[str, Any]) -> Optional[str]:
        """Phonecheck cihaz kaydini service_test_result_type koduna cevirir.

        None donerse test henuz tamamlanmamistir -> statu degistirilmemelidir.
        """
        working = str(device.get("Working", "")).strip().lower()
        cosmetics_working = str(device.get("CosmeticsWorking", "")).strip().lower()

        if cls._has_items(device.get("Failed")) or working == "no" or cosmetics_working == "no":
            return "Fail1"

        if cls._has_items(device.get("Pending")) or working == "pending" or cosmetics_working == "pending":
            return None

        return "Pass1"

    @staticmethod
    def _to_int(value):
        try:
            if value is None or str(value).strip() == "":
                return None
            return int(float(value))
        except (TypeError, ValueError):
            return None

    @classmethod
    def to_db_row(cls, device: Dict[str, Any]) -> Dict[str, Any]:
        """Phonecheck ham yanitini tablo kolonlarina esler.
        imei / test_stage / attempt_no cagiran tarafta eklenir."""
        row = {}
        for column, api_field in FIELD_MAP.items():
            value = device.get(api_field)
            if column in INT_COLUMNS:
                value = cls._to_int(value)
            elif value is not None:
                value = str(value)
            row[column] = value
        return row

    # --- Sayaclar ------------------------------------------------------------

    def attempt_count(self, imei: str, test_stage: str) -> int:
        """Bu cihazin bu test adimindaki toplam deneme sayisi."""
        return self.db.query(PhonecheckTestResult).filter(
            PhonecheckTestResult.imei == imei,
            PhonecheckTestResult.test_stage == test_stage,
        ).count()

    # --- Phonecheck API ------------------------------------------------------

    def fetch_device(self, term: str) -> Dict[str, Any]:
        """IMEI veya seri numarasina gore Phonecheck'ten cihazi getirir.

        Bulunamazsa needs_manual=True doner; cagiran taraf manuel formu acmalidir.
        """
        api_key = get_api_key()
        username = get_username()

        def manual(message):
            return {
                "success": False,
                "needs_manual": True,
                "message": message,
                "manual_fields": MANUAL_FIELDS,
            }

        if not api_key:
            return manual("Phonecheck API anahtari tanimli degil (.env icindeki PHONECHECK_API_KEY / PHONECHECK_APIKEY).")

        term = (term or "").strip()
        if not term:
            return {"success": False, "needs_manual": False, "message": "IMEI veya seri numarasi bos olamaz."}

        try:
            resp = requests.post(
                PHONECHECK_DEVICE_URL,
                json={"Apikey": api_key, "Username": username, "IMEI": term},
                timeout=30,
            )
        except requests.RequestException as e:
            return manual(f"Phonecheck'e baglanilamadi: {e}")

        if resp.status_code == 404:
            return manual(f"'{term}' Phonecheck'te bulunamadi. Test verisi elle doldurulmali.")

        if resp.status_code != 200:
            return manual(f"Phonecheck hatasi ({resp.status_code}): {resp.text[:200]}")

        try:
            data = resp.json()
        except ValueError:
            return manual("Phonecheck beklenmeyen bir yanit dondu.")

        # Uc nokta tek nesne veya tek elemanli liste donebilir
        if isinstance(data, list):
            data = data[0] if data else None

        if not isinstance(data, dict) or not data.get("IMEI"):
            return manual(f"'{term}' Phonecheck'te bulunamadi. Test verisi elle doldurulmali.")

        return {"success": True, "device": data}

    # --- Kayit ---------------------------------------------------------------

    def save_from_phonecheck(self, device: Dict[str, Any], test_stage: str,
                             imei: Optional[str] = None) -> PhonecheckTestResult:
        """Phonecheck'ten gelen cihaz verisini tabloya yazar."""
        record_imei = (imei or device.get("IMEI") or "").strip()
        record = PhonecheckTestResult(
            imei=record_imei,
            test_stage=test_stage,
            attempt_no=self.attempt_count(record_imei, test_stage) + 1,
            is_manual=False,
            **self.to_db_row(device),
        )
        self.db.add(record)
        self.db.commit()
        return record

    def save_manual(
        self,
        imei: str,
        test_stage: str,
        manual_reason: str,
        entered_by: Optional[str] = None,
        fields: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Phonecheck'te bulunamayan cihaz icin elle girilen test kaydini yazar.
        manual_reason zorunludur."""
        if not (manual_reason or "").strip():
            return {"success": False, "message": "Aciklama alani zorunludur."}
        if not (imei or "").strip():
            return {"success": False, "message": "IMEI bos olamaz."}

        imei = imei.strip()
        record = PhonecheckTestResult(
            imei=imei,
            test_stage=test_stage,
            attempt_no=self.attempt_count(imei, test_stage) + 1,
            is_manual=True,
            manual_reason=manual_reason.strip(),
            manual_entered_by=entered_by,
        )

        for column, value in (fields or {}).items():
            if column not in MANUAL_FIELDS:
                continue
            if column in INT_COLUMNS:
                value = self._to_int(value)
            elif value is not None:
                value = str(value)
            setattr(record, column, value)

        self.db.add(record)
        self.db.commit()
        return {"success": True, "id": record.id, "attempt_no": record.attempt_no}


def get_all_devices(startdate=None, enddate=None, station=None, date=None, limit=500, offset=0):
    """Phonecheck 'Get All Devices V2' API'sini toplu (raporlama/export) amacli cagirir.
    https://phonecheck.atlassian.net/wiki/spaces/KB/pages/2271772692/"""
    apikey = get_api_key()
    username = get_username()

    if not apikey:
        raise ValueError("PHONECHECK_API_KEY / PHONECHECK_APIKEY .env içinde tanımlı değil.")

    payload = {"Apikey": apikey, "Username": username, "limit": limit}
    if offset:
        payload["offset"] = offset
    if date:
        payload["Date"] = date
    if startdate:
        payload["startdate"] = startdate
    if enddate:
        payload["enddate"] = enddate
    if station:
        payload["Station"] = station

    resp = requests.post(PHONECHECK_URL, json=payload, timeout=30)
    if resp.status_code == 404:
        return []
    resp.raise_for_status()
    return resp.json()
