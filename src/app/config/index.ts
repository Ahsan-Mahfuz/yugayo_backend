import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  NODE_ENV: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  default_password: process.env.DEFAULT_PASSWORD,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  apple_client_id: process.env.APPLE_CLIENT_ID || "",
  google_client_id: process.env.GOOGLE_CLIENT_ID || "",
  ai_service_url: process.env.AI_SERVICE_URL || "",
  smtp: {
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_service: process.env.SMTP_SERVICE,
    smtp_mail: process.env.SMTP_MAIL,
    smtp_pass: process.env.SMTP_PASS,
    name: process.env.SMTP_NAME,
  },
  web_client_id: process.env.WEB_CLIENT_ID || "",
  debug_android_client_id: process.env.debug_android_client_id || "",
  release_android_client_id: process.env.release_android_client_id || "",
};
