import os
from typing import Dict, Any, Optional
from datetime import datetime

import requests
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.phonecheck_test_result import PhonecheckTestResult

PHONECHECK_URL = "https://clientapiv2.phonecheck.com/cloud/CloudDB/v2/GetAllDevices"
PHONECHECK_USERNAME = "out1"

# Statu gecisleri -> test asamasi eslemesi
STAGE_BY_TRANSITION = {
    (103, 104): "ILK_TEST",
    (125, 109): "SON_TEST",
}

# Excel sutunu -> tablo kolonu eslemesi (Phonecheck API alan adlariyla)
FIELD_MAP = {
    "test_type": "Type",
    "test_start_time": "StartTime",
    "test_end_time": "EndTime",
    "invoice_no": "InvoiceNo",
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
}

# Manuel doldurmada kullaniciya sunulacak temel alanlar
MANUAL_FIELDS = ["working", "grade", "model", "memory", "serial", "color", "notes"]


class PhonecheckService:
    def __init__(self, db: Session):
        self.db = db

    # --- Yardimcilar ---------------------------------------------------------

    @staticmethod
    def get_stage(current_statu_code: int, target_statu_code: int) -> Optional[str]:
        """Statu gecisinden test asamasini belirler. Test asamasi degilse None."""
        return STAGE_BY_TRANSITION.get((current_statu_code, target_statu_code))

    @staticmethod
    def _to_int(value):
        try:
            return int(str(value).strip())
        except (TypeError, ValueError):
            return None

    def _next_attempt_no(self, imei: str) -> int:
        """Bu IMEI'nin kacinci son test denemesi oldugunu bulur (cihaz bazli sayac)."""
        last = self.db.query(func.max(PhonecheckTestResult.attempt_no)).filter(
            PhonecheckTestResult.imei == imei,
            PhonecheckTestResult.test_stage == "SON_TEST",
        ).scalar()
        return (last or 0) + 1

    # --- Phonecheck API ------------------------------------------------------

    def fetch_device(self, term: str) -> Dict[str, Any]:
        """Phonecheck'ten IMEI veya seri numarasina gore cihazi getirir.

        Bulunamazsa success=False ve manuel doldurma icin gerekli bilgiyi doner.
        """
        api_key = os.getenv("PHONECHECK_API_KEY")
        if not api_key:
            return {
                "success": False,
                "needs_manual": True,
                "message": "Phonecheck API anahtari tanimli degil (.env icindeki PHONECHECK_API_KEY).",
                "manual_fields": MANUAL_FIELDS,
            }

        term = (term or "").strip()
        if not term:
            return {
                "success": False,
                "needs_manual": False,
                "message": "IMEI veya seri numarasi bos olamaz.",
            }

        try:
            resp = requests.post(
                PHONECHECK_URL,
                json={"Apikey": api_key, "Username": PHONECHECK_USERNAME, "limit": 500},
                timeout=30,
            )
        except requests.RequestException as e:
            return {
                "success": False,
                "needs_manual": True,
                "message": f"Phonecheck'e baglanilamadi: {e}",
                "manual_fields": MANUAL_FIELDS,
            }

        if resp.status_code != 200:
            return {
                "success": False,
                "needs_manual": True,
                "message": f"Phonecheck hatasi ({resp.status_code}): {resp.text[:200]}",
                "manual_fields": MANUAL_FIELDS,
            }

        try:
            data = resp.json()
        except ValueError:
            return {
                "success": False,
                "needs_manual": True,
                "message": "Phonecheck beklenmeyen bir yanit dondu.",
                "manual_fields": MANUAL_FIELDS,
            }

        devices = [d for d in data if isinstance(d, dict) and "IMEI" in d]
        match = next(
            (d for d in devices
             if str(d.get("IMEI", "")).strip() == term
             or str(d.get("IMEI2", "")).strip() == term
             or str(d.get("Serial", "")).strip().lower() == term.lower()),
            None,
        )

        if not match:
            return {
                "success": False,
                "needs_manual": True,
                "message": f"'{term}' Phonecheck'te bulunamadi. Test verisi elle doldurulmali.",
                "manual_fields": MANUAL_FIELDS,
            }

        return {"success": True, "device": match}

    # --- Kayit ---------------------------------------------------------------

    def save_from_phonecheck(self, device: Dict[str, Any], test_stage: str) -> PhonecheckTestResult:
        """Phonecheck'ten gelen cihaz verisini tabloya yazar."""
        record = PhonecheckTestResult(
            imei=str(device.get("IMEI", "")).strip(),
            test_stage=test_stage,
            is_manual=False,
        )

        for column, api_field in FIELD_MAP.items():
            value = device.get(api_field)
            if column in ("battery_cycle", "battery_health_percentage"):
                value = self._to_int(value)
            elif value is not None:
                value = str(value)
            setattr(record, column, value)

        if test_stage == "SON_TEST":
            record.attempt_no = self._next_attempt_no(record.imei)

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

        manual_reason zorunludur; bos gonderilirse kayit olusturulmaz.
        """
        if not (manual_reason or "").strip():
            return {"success": False, "message": "Aciklama alani zorunludur."}

        if not (imei or "").strip():
            return {"success": False, "message": "IMEI bos olamaz."}

        record = PhonecheckTestResult(
            imei=imei.strip(),
            test_stage=test_stage,
            is_manual=True,
            manual_reason=manual_reason.strip(),
            manual_entered_by=entered_by,
        )

        for column, value in (fields or {}).items():
            if column not in MANUAL_FIELDS:
                continue
            if column in ("battery_cycle", "battery_health_percentage"):
                value = self._to_int(value)
            elif value is not None:
                value = str(value)
            setattr(record, column, value)

        if test_stage == "SON_TEST":
            record.attempt_no = self._next_attempt_no(record.imei)

        self.db.add(record)
        self.db.commit()
        return {"success": True, "id": record.id, "attempt_no": record.attempt_no}


def get_all_devices(startdate=None, enddate=None, station=None, date=None, limit=500, offset=0):
    """Phonecheck 'Get All Devices V2' API'sini toplu (raporlama/export) amaçlı çağırır.
    https://phonecheck.atlassian.net/wiki/spaces/KB/pages/2271772692/"""
    apikey = os.getenv("PHONECHECK_API_KEY")
    username = os.getenv("PHONECHECK_USERNAME") or PHONECHECK_USERNAME

    if not apikey:
        raise ValueError("PHONECHECK_API_KEY .env içinde tanımlı değil.")

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
