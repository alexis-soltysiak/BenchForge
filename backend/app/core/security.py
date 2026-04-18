def mask_secret(value: str | None, visible_suffix: int = 4) -> str | None:
    if value is None:
        return None
    if len(value) <= visible_suffix:
        return "*" * len(value)
    return "*" * (len(value) - visible_suffix) + value[-visible_suffix:]


def build_bearer_token(token: str) -> str:
    return f"Bearer {token}"

