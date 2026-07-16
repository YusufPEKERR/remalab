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

    def create(self, username: str, tc_no: str, password_hash: str, role: str, gorev: Optional[str] = None, fullname: Optional[str] = None, account_enabled: bool = True, team_leader: Optional[str] = None, operation_manager: Optional[str] = None, administrative_manager: Optional[str] = None) -> User:
        user = User(
            username=username, tc_no=tc_no, password_hash=password_hash, role=role, gorev=gorev, fullname=fullname,
            account_enabled=account_enabled, team_leader=team_leader, operation_manager=operation_manager, administrative_manager=administrative_manager
        )
        self.db.add(user)
        self.db.flush()
        return user

    def update(
        self,
        user_id: int,
        username: str,
        tc_no: str,
        role: str,
        gorev: Optional[str] = None,
        fullname: Optional[str] = None,
        password_hash: Optional[str] = None,
        account_enabled: Optional[bool] = None,
        team_leader: Optional[str] = None,
        operation_manager: Optional[str] = None,
        administrative_manager: Optional[str] = None,
    ) -> Optional[User]:
        user = self.db.get(User, user_id)
        if user is None:
            return None
        user.username = username
        user.tc_no = tc_no
        user.role = role
        if gorev is not None:
            user.gorev = gorev
        if fullname is not None:
            user.fullname = fullname
        if password_hash is not None:
            user.password_hash = password_hash
        if account_enabled is not None:
            user.account_enabled = account_enabled
        if team_leader is not None:
            user.team_leader = team_leader
        if operation_manager is not None:
            user.operation_manager = operation_manager
        if administrative_manager is not None:
            user.administrative_manager = administrative_manager
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
