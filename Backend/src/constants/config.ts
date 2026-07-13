import { config } from 'dotenv'

config()

export const envConfig = {
  port: process.env.PORT,

  // Database
  dbHost: process.env.PGHOST,
  dbPort: process.env.PGPORT as string,
  dbDataBase: process.env.PGDATABASE,
  dbUser: process.env.PGUSER,
  dbPassword: process.env.PGPASSWORD,
  databaseURL: process.env.DATABASE_URL,

  // Secret
  jwtSecretAccessToken: process.env.JWT_SECRET_ACCESS_TOKEN,
  jwtSecretRefreshToken: process.env.JWT_SECRET_REFRESH_TOKEN,
  jwtSecretEmailVerifyToken: process.env.JWT_SECRET_EMAIL_VERIFY_TOKEN,
  jwtSecretForgotPasswordToken: process.env.JWT_SECRET_FORGOT_PASSWORD_TOKEN,
  jwtSecretQRCodeToken: process.env.JWT_SECRET_QRCODE_TOKEN,
  passwordSecret: process.env.PASSWORD_SECRET,

  // Expires
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
  emailVerifyTokenExpiresIn: process.env.EMAIL_VERIFY_TOKEN_EXPIRES_IN,
  forgotPasswordTokenExpiresIn: process.env.FORGOT_PASSWORD_TOKEN_EXPIRES_IN as string,

  // AWS
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  awsRegion: process.env.AWS_REGION as string,
  sesFromAddress: process.env.SES_FROM_ADDRESS as string,
  clientUrl: process.env.CLIENT_URL as string,
  s3BucketName: process.env.S3_BUCKET_NAME as string
}
