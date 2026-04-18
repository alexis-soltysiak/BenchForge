import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import Settings, get_settings


def _derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet(settings: Settings | None = None) -> Fernet:
    app_settings = settings or get_settings()
    return Fernet(_derive_fernet_key(app_settings.encryption_key))


def encrypt_value(value: str, settings: Settings | None = None) -> str:
    token = get_fernet(settings).encrypt(value.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_value(value: str, settings: Settings | None = None) -> str:
    plaintext = get_fernet(settings).decrypt(value.encode("utf-8"))
    return plaintext.decode("utf-8")

