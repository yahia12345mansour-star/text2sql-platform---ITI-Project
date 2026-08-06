from cryptography.fernet import Fernet

from app.core.config import settings

# Fernet is a simple, secure way to encrypt/decrypt short pieces of text
# (like a database password) using one shared secret key.
_fernet = Fernet(settings.encryption_key.encode())


def encrypt_value(plain_text: str) -> str:
    return _fernet.encrypt(plain_text.encode()).decode()


def decrypt_value(encrypted_text: str) -> str:
    return _fernet.decrypt(encrypted_text.encode()).decode()
