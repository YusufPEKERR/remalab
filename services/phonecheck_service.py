"""
Phonecheck entegrasyonu: tek IMEI icin cihaz/test bilgisini ceker ve
Statumap akis semasindaki (Pass1/Fail1) test sonucu koduna cevirir.
"""
import os
import requests

DEVICE_INFO_ENDPOINTS = {
    "us": "https://clientapiv2.phonecheck.com/cloud/cloudDB/GetDeviceInfo",
    "eu": "https://eu-clientapiv2.phonecheck.com/cloudDB/GetDeviceInfo",
}


class PhonecheckService:
    def __init__(self):
        self.apikey = os.getenv("PHONECHECK_APIKEY")
        self.username = os.getenv("PHONECHECK_USERNAME")
        self.region = (os.getenv("PHONECHECK_REGION") or "us").lower()

    def get_device_info(self, imei: str) -> dict:
        if not self.apikey or not self.username:
            raise RuntimeError("PHONECHECK_APIKEY / PHONECHECK_USERNAME .env icinde tanimli degil.")

        url = DEVICE_INFO_ENDPOINTS.get(self.region, DEVICE_INFO_ENDPOINTS["us"])
        payload = {"apiKey": self.apikey, "username": self.username, "imei": imei}
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            return data[0] if data else {}
        return data

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
    def to_test_result_code(cls, device: dict):
        """Phonecheck cihaz kaydini Statumap'teki test_result_code degerine cevirir.
        Donen deger None ise test henuz tamamlanmamis demektir (gecis yapilmamali)."""
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

    @staticmethod
    def _split_tests(value, status):
        if not value or not str(value).strip():
            return []
        return [f"{name.strip()}: {status}" for name in str(value).split(",") if name.strip()]

    @classmethod
    def to_db_row(cls, device: dict) -> dict:
        """Phonecheck GetDeviceInfo ham yanitini warehouse.phonecheck_test_results
        tablosunun sutunlarina esler (imei/test_stage/attempt_no cagiran tarafta eklenir)."""
        tests = (
            cls._split_tests(device.get("Passed"), "Pass")
            + cls._split_tests(device.get("Failed"), "Fail")
            + cls._split_tests(device.get("Pending"), "Pending")
        )
        test_result_cols = {f"test_result_{i}": (tests[i - 1] if i <= len(tests) else None) for i in range(1, 11)}

        return {
            "test_type": device.get("TestPlanName"),
            "test_start_time": device.get("StartTime"),
            "test_end_time": device.get("EndTime"),
            "station_id": device.get("StationID"),
            "working": device.get("Working"),
            "passed": device.get("Passed"),
            "failed": device.get("Failed"),
            "pending": device.get("Pending"),
            **test_result_cols,
            "model": device.get("Model"),
            "memory": device.get("Memory"),
            "serial": device.get("Serial"),
            "color": device.get("Color"),
            "grade": device.get("Grade"),
            "version": device.get("Version"),
            "notes": device.get("Notes"),
            "battery_cycle": cls._to_int(device.get("BatteryCycle")),
            "battery_health_percentage": cls._to_int(device.get("BatteryHealthPercentage")),
            "grading_results": device.get("Cosmetics"),
        }
