from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    GROQ_API_KEY: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    class Config:
        env_file = ".env"


settings = Settings()
