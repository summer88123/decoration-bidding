from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PORT: int = 3008
    LOG_LEVEL: str = "info"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/decoration_bidding"
    RABBITMQ_URL: str = "amqp://localhost:5672"
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "decoration-bidding"

    class Config:
        env_file = ".env"


settings = Settings()
