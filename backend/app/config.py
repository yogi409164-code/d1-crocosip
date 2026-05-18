from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "mysql+pymysql://root:password@localhost:3306/fruitzila"
    jwt_secret: str = "fruitzila-dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    otp_expire_minutes: int = 10
    otp_length: int = 6
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    phonepe_merchant_id: str = ""
    phonepe_salt_key: str = ""
    debug: bool = True
    msg91_auth_key: str = ""
    msg91_template_id: str = ""
    msg91_sender_id: str = ""
    msg91_country_code: str = "91"
    google_client_id: str = ""


settings = Settings()
