from app.core.config import Settings
from app.core.encryption import decrypt_value, encrypt_value
from app.core.security import build_bearer_token, mask_secret


def test_encrypt_and_decrypt_round_trip() -> None:
    settings = Settings(ENCRYPTION_KEY="unit-test-encryption-key")

    encrypted = encrypt_value("super-secret", settings)

    assert encrypted != "super-secret"
    assert decrypt_value(encrypted, settings) == "super-secret"


def test_mask_secret_keeps_suffix() -> None:
    assert mask_secret("abcdef123456", visible_suffix=4) == "********3456"
    assert mask_secret("abcd", visible_suffix=4) == "****"
    assert mask_secret(None) is None


def test_build_bearer_token() -> None:
    assert build_bearer_token("abc123") == "Bearer abc123"

