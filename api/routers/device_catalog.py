from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from api.schemas.device_catalog_schema import BrandInfo, DeviceCategory, DeviceListResponse, DeviceRead
from services import device_catalog_client
from services.exceptions import (
    DeviceCatalogAuthError,
    DeviceCatalogConnectionError,
    DeviceCatalogError,
    DeviceCatalogNotFoundError,
)

router = APIRouter(prefix="/api/device-catalog", tags=["DeviceCatalog"])


def _to_http_exception(exc: DeviceCatalogError) -> HTTPException:
    if isinstance(exc, DeviceCatalogNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, DeviceCatalogAuthError):
        # RemaLab'in DeviceCatalog için kullandığı API key hatalı/eksik; bu RemaLab
        # istemcisinin hatası değil, upstream servisle iletişim sorunu.
        return HTTPException(status_code=502, detail="DeviceCatalog servisi kimlik doğrulama hatası verdi.")
    if isinstance(exc, DeviceCatalogConnectionError):
        return HTTPException(status_code=503, detail="DeviceCatalog servisine şu anda ulaşılamıyor.")
    return HTTPException(status_code=502, detail=str(exc))


@router.get("/brands", response_model=list[BrandInfo])
def get_brands():
    """DeviceCatalog'daki tüm markaları ve cihaz sayılarını döner."""
    try:
        return device_catalog_client.get_brands()
    except DeviceCatalogError as exc:
        raise _to_http_exception(exc) from exc


@router.get("/devices", response_model=DeviceListResponse)
def get_devices(
    brand: Optional[str] = None,
    category: Optional[DeviceCategory] = None,
    model_family: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Filtrelenmiş cihaz listesini sayfalı şekilde döner."""
    try:
        return device_catalog_client.get_devices(
            brand=brand,
            category=category,
            model_family=model_family,
            is_active=is_active,
            search=search,
            limit=limit,
            offset=offset,
        )
    except DeviceCatalogError as exc:
        raise _to_http_exception(exc) from exc


@router.get("/devices/{device_id}", response_model=DeviceRead)
def get_device_by_id(device_id: int):
    """Tek bir cihazı id ile getirir."""
    try:
        return device_catalog_client.get_device_by_id(device_id)
    except DeviceCatalogError as exc:
        raise _to_http_exception(exc) from exc


@router.get("/search", response_model=DeviceListResponse)
def search_devices(
    q: str = Query(..., min_length=1, description="Model adında arama"),
    brand: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Model adında serbest metin araması yapar."""
    try:
        return device_catalog_client.search_devices(query=q, brand=brand, limit=limit, offset=offset)
    except DeviceCatalogError as exc:
        raise _to_http_exception(exc) from exc
