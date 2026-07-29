import os
import requests

US_URL = "https://clientapiv2.phonecheck.com/cloud/CloudDB/v2/GetAllDevices"
EU_URL = "https://eu-clientapiv2.phonecheck.com/cloudDB/v2/GetAllDevices"


def get_all_devices(startdate=None, enddate=None, station=None, date=None, limit=500, offset=0):
    """Phonecheck 'Get All Devices V2' API'sini çağırır.
    https://phonecheck.atlassian.net/wiki/spaces/KB/pages/2271772692/"""
    apikey = os.getenv("PHONECHECK_APIKEY")
    username = os.getenv("PHONECHECK_USERNAME")
    region = (os.getenv("PHONECHECK_REGION") or "us").lower()

    if not apikey or not username:
        raise ValueError("PHONECHECK_APIKEY / PHONECHECK_USERNAME .env içinde tanımlı değil.")

    url = EU_URL if region == "eu" else US_URL

    payload = {
        "Apikey": apikey,
        "Username": username,
        "limit": limit,
        "offset": offset,
    }
    if date:
        payload["Date"] = date
    if startdate:
        payload["startdate"] = startdate
    if enddate:
        payload["enddate"] = enddate
    if station:
        payload["Station"] = station

    resp = requests.post(url, json=payload, timeout=30)
    if resp.status_code == 404:
        return []
    resp.raise_for_status()
    return resp.json()
