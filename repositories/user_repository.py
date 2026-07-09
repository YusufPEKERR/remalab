from __future__ import annotations
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from models.user import User


class UserRepository:
    """Users tablosuna ham DB erişimi. Commit/rollback yönetmez."""

    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[User]:
        return list(self.db.execute(select(User).order_by(User.id)).scalars().all())

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def create(self, username: str, email: str, password_hash: str, role: str) -> User:
        user = User(
            username=username, email=email, password_hash=password_hash, role=role
        )
        self.db.add(user)
        self.db.flush()
        return user

    def update(
        self,
        user_id: int,
        username: str,
        email: str,
        role: str,
        password_hash: Optional[str] = None,
    ) -> Optional[User]:
        user = self.db.get(User, user_id)
        if user is None:
            return None
        user.username = username
        user.email = email
        user.role = role
        if password_hash is not None:
            user.password_hash = password_hash
        self.db.flush()
        return user

    def update_password(self, user_id: int, password_hash: str) -> User | None:
        user = self.db.get(User, user_id)
        if user is None:
            return None
        user.password_hash = password_hash
        self.db.flush()
        return user

    def delete(self, user_id: int) -> bool:
        user = self.db.get(User, user_id)
        if user is None:
            return False
        self.db.delete(user)
        self.db.flush()
        return True
