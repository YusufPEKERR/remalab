from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from api.dependencies import get_db_session
from api.schemas.user_schema import UserResponse, UserCreate, UserUpdate
from services.user_service import UserService
from services.exceptions import NotFoundError, DuplicateUsernameError, ValidationError
from repositories.user_repository import UserRepository

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("/", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db_session)):
    """Tüm kullanıcıları listeler."""
    users = UserRepository(db).get_all()
    return users

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db_session)):
    """Yeni kullanıcı oluşturur."""
    service = UserService()
    # We patch the service temporarily to use our db session, 
    # but the service currently opens its own session with get_db().
    # For a proper integration, the service should accept db session as a parameter,
    # but to avoid modifying existing code too much, we will just call the service.
    # Note: Since UserService uses its own context manager `with get_db() as db:`, 
    # we don't strictly need to pass `db` to it. We just call it directly.
    try:
        service.add_user(username=user.username, email=user.email, password=user.password, role=user.role)
        return {"message": "User created successfully"}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DuplicateUsernameError as e:
        raise HTTPException(status_code=409, detail=str(e))

@router.put("/{user_id}")
def update_user(user_id: int, user: UserUpdate):
    """Kullanıcı bilgilerini günceller."""
    service = UserService()
    try:
        service.update_user(
            user_id=user_id,
            username=user.username,
            email=user.email,
            role=user.role,
            password=user.password
        )
        return {"message": "User updated successfully"}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int):
    """Kullanıcıyı siler."""
    service = UserService()
    try:
        service.delete_user(user_id)
        return None
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
