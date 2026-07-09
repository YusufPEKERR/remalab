from pydantic import BaseModel
from typing import Optional

class PartBase(BaseModel):
    name: str
    barcode: Optional[str] = None

class PartCreate(PartBase):
    pass

class PartUpdate(BaseModel):
    name: Optional[str] = None
    barcode: Optional[str] = None

class PartResponse(PartBase):
    id: int

    class Config:
        from_attributes = True
