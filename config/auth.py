import jwt
import bcrypt
import os
import secrets
from datetime import datetime, timedelta, timezone

# SECRET_KEY sabit/kaynağa gömülü OLMAMALI: eskiden koda gömülü bilinen bir varsayılan
# vardı, bu değerle JWT sahtelenebiliyordu. Öncelik .env'deki SECRET_KEY'dir. Tanımlı
# değilse süreç başına RASTGELE bir anahtar üretilir (kaynakta sabit sır bırakmaz).
# Not: rastgele anahtar her yeniden başlatmada değişir; kalıcı oturumlar isteniyorsa
# .env içine güçlü ve sabit bir SECRET_KEY konmalıdır.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_urlsafe(48)
    print("[WARN] SECRET_KEY .env'de tanimli degil; sureç icin rastgele bir anahtar "
          "uretildi. Kalici oturumlar icin .env'e guclu bir SECRET_KEY ekleyin.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


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
