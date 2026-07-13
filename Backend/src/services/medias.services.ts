import { uploadFileToS3 } from '~/utils/s3'
import { getNameFromFullname, handleUploadImage } from '~/utils/file'
import { UPLOAD_IMAGE_DIR } from '~/constants/dir'
import { Request } from 'express'

import fsPromise, { unlink } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

class MediasService {
  async uploadImage(req: Request) {
    const files = await handleUploadImage(req)

    const result = await Promise.all(
      files.map(async (file) => {
        const newName = getNameFromFullname(file.newFilename)
        const newFullFilename = `${newName}.jpg`
        const newPath = path.resolve(UPLOAD_IMAGE_DIR, `${newFullFilename}`)
        sharp.cache(false)
        await sharp(file.filepath).jpeg().toFile(newPath)

        // Import mime dynamically to avoid circular dependency issues
        // const mime = await import('mime')

        const s3Result = await uploadFileToS3({
          filename: 'avatar-images/' + newFullFilename,
          filePath: newPath,
          contentType: 'image/jpeg'
        })

        try {
          await unlink(file.filepath)
        } catch (err) {
          console.error('Failed to unlink temp file:', file.filepath, err)
        }

        try {
          await unlink(newPath)
        } catch (err) {
          console.error('Failed to unlink processed file:', newPath, err)
        }

        return {
          url: s3Result.Location as string
        }
      })
    )
    return result
  }
}

const mediasService = new MediasService()
export default mediasService
