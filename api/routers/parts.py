from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from api.dependencies import get_db_session
from api.schemas.part_schema import PartResponse, PartCreate, PartUpdate
from services.part_service import PartService
from services.exceptions import NotFoundError, ValidationError
from repositories.part_repository import PartRepository

router = APIRouter(prefix="/api/parts", tags=["Parts"])

@router.get("/", response_model=List[PartResponse])
def get_parts(search: Optional[str] = None, db: Session = Depends(get_db_session)):
    """Tüm parçaları listeler. Arama yapılabilir."""
    parts = PartRepository(db).get_all(search=search)
    return parts

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_part(part: PartCreate):
    """Yeni parça oluşturur."""
    service = PartService()
    try:
        part_id = service.add_part(name=part.name, barcode=part.barcode)
        return {"id": part_id, "message": "Part created successfully"}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{part_id}")
def update_part(part_id: int, part: PartUpdate):
    """Parça bilgilerini günceller."""
    service = PartService()
    try:
        service.update_part(part_id, part.name)
        return {"message": "Part updated successfully"}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{part_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_part(part_id: int):
    """Parçayı siler."""
    service = PartService()
    try:
        service.delete_part(part_id)
        return None
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
