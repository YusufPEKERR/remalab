from __future__ import annotations
from typing import Optional
from sqlalchemy.exc import IntegrityError

from config.auth import get_password_hash
from config.database import get_db
from repositories.user_repository import UserRepository
from services.exceptions import DuplicateUsernameError, NotFoundError, ValidationError


class UserService:
    def list_users(self) -> list[dict]:
        with get_db() as db:
            return [
                {
                    "id": u.id,
                    "username": u.username,
                    "tc_no": u.tc_no,
                    "role": u.role,
                    "gorev": u.gorev or "",
                    "fullname": u.fullname or ""
                }
                for u in UserRepository(db).get_all()
            ]

    def add_user(self, username: str, tc_no: str, password: str, role: str, gorev: Optional[str] = None, fullname: Optional[str] = None) -> None:
        if not username or not password:
            raise ValidationError("Kullanıcı adı ve şifre zorunludur.")

        password_hash = get_password_hash(password)
        with get_db() as db:
            try:
                UserRepository(db).create(username, tc_no, password_hash, role, gorev, fullname)
                db.commit()
            except IntegrityError:
                db.rollback()
                raise DuplicateUsernameError(
                    f"'{username}' kullanıcı adı veya TC kimlik numarası zaten kayıtlı."
                )

    def update_user(
        self,
        user_id: int,
        username: str,
        tc_no: str,
        role: str,
        gorev: Optional[str] = None,
        fullname: Optional[str] = None,
        password: Optional[str] = None,
    ) -> None:
        if not username:
            raise ValidationError("Kullanıcı adı zorunludur.")

        password_hash = get_password_hash(password) if password else None
        with get_db() as db:
            repo = UserRepository(db)
            try:
                user = repo.update(user_id, username, tc_no, role, gorev, fullname, password_hash)
                if user is None:
                    raise NotFoundError("Kullanıcı bulunamadı.")
                db.commit()
            except IntegrityError:
                db.rollback()
                raise DuplicateUsernameError(
                    f"'{username}' kullanıcı adı veya e-posta zaten kayıtlı."
                )

    def reset_password(self, user_id: int, new_password: str) -> None:
        if not new_password:
            raise ValidationError("Yeni şifre zorunludur.")

        password_hash = get_password_hash(new_password)
        with get_db() as db:
            user = UserRepository(db).update_password(user_id, password_hash)
            if user is None:
                raise NotFoundError("Kullanıcı bulunamadı.")
            db.commit()

    def delete_user(self, user_id: int) -> None:
        with get_db() as db:
            deleted = UserRepository(db).delete(user_id)
            if not deleted:
                raise NotFoundError("Kullanıcı bulunamadı.")
            db.commit()
