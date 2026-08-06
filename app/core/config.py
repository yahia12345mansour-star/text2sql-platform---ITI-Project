from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    encryption_key: str
    openai_api_key: str

    class Config:
        env_file = ".env"


settings = Settings()
