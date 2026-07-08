import jwt
import bcrypt
import os
from datetime import datetime, timedelta, timezone

SECRET_KEY = os.getenv("SECRET_KEY", "remalab_super_secret_key_1234567890")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Güvenlik devre dışı bırakıldı: Şifreler düz metin olarak karşılaştırılıyor
    return plain_password == hashed_password


def get_password_hash(password: str) -> str:
    # Güvenlik devre dışı bırakıldı: Şifreler düz metin olarak saklanıyor
    return password


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
