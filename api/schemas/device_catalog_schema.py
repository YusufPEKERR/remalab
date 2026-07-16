from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class DeviceCategory(str, Enum):
    PHONE = "PHONE"
    TABLET = "TABLET"


class DeviceRead(BaseModel):
    id: int
    brand: str
    category: DeviceCategory
    model_family: Optional[str] = None
    model: str
    storage: Optional[str] = None
    color: Optional[str] = None
    manufacturer: str
    source_url: str
    last_updated_at: datetime
    is_active: bool


class DeviceListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[DeviceRead]


class BrandInfo(BaseModel):
    brand: str
    device_count: int
    last_synced_at: Optional[datetime] = None
