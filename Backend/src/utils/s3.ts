import { S3Client, S3, PutObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { envConfig } from '~/constants/config'

import fs from 'fs'

const s3 = new S3({
  region: envConfig.awsRegion,
  credentials: {
    secretAccessKey: envConfig.awsSecretAccessKey as string,
    accessKeyId: envConfig.awsAccessKeyId as string
  }
})

//D:\1_Website\Backend\Twitter\uploads\images\5d5ba74e2e47d492678728900.jpg
// const file = fs.readFileSync(path.resolve('uploads/images/5d5ba74e2e47d492678728900.jpg'))

export async function uploadFileToS3({
  filename,
  filePath,
  contentType
}: {
  filename: string
  filePath: string
  contentType: string
}) {
  const body = fs.createReadStream(filePath)

  await s3.send(
    new PutObjectCommand({
      Bucket: envConfig.s3BucketName,
      Key: filename,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read'
    })
  )
  const url = `https://${envConfig.s3BucketName}.s3.${envConfig.awsRegion}.amazonaws.com/${filename}`
  return {
    Location: url
  }
}

export const sendFileFromS3 = async (res: Response, filePath: string) => {
  const data = await s3.getObject({
    Bucket: envConfig.s3BucketName,
    Key: filePath
  })
}
