import formidable, { File } from 'formidable'
import { Request } from 'express'
import { UPLOAD_IMAGE_TEMP_DIR } from '~/constants/dir'

import fs from 'fs'
import ErrorWithStatus, { EntityError } from '~/models/Errors'
import HTTP_STATUS from '~/constants/httpStatus'
import { MEDIAS_MESSAGES, USERS_MESSAGES } from '~/constants/messages'
import { reject } from 'lodash'

export const initFolder = () => {
  ;[UPLOAD_IMAGE_TEMP_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {
        recursive: true
      })
    }
  })
}

export const getNameFromFullname = (fullname: string) => {
  const name = fullname.split('.')
  name.pop()
  return name.join('')
}

export const handleUploadImage = (req: Request) => {
  let rejectedByType = false
  const form = formidable({
    uploadDir: UPLOAD_IMAGE_TEMP_DIR,
    keepExtensions: true,

    filter: function ({ name, originalFilename, mimetype }) {
      const valid = name === 'image' && Boolean(mimetype?.includes('image/'))
      if (!valid) {
        rejectedByType = true
        return false
      }
      return true
    }
  })

  return new Promise<File[]>((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        return reject(err)
      }
      if ((!files.image || (files.image as File[]).length === 0) && rejectedByType) {
        return reject(
          new EntityError({
            errors: {
              image: {
                type: 'field',
                value: null,
                msg: MEDIAS_MESSAGES.IMAGE_TYPE_IS_NOT_VALID,
                path: 'image',
                location: 'files'
              }
            }
          })
        )
      }

      // Check if image file is provided
      if (!files.image || files.image.length === 0) {
        return reject(
          new EntityError({
            errors: {
              image: {
                type: 'field',
                value: null, // or null
                msg: MEDIAS_MESSAGES.IMAGE_IS_REQUIRED,
                path: 'image',
                location: 'files'
              }
            }
          })
        )
      }

      // Only one image is allowed
      if (files.image.length > 1) {
        const imgs = files.image as File[]
        imgs.forEach((file) => {
          fs.unlink(file.filepath, (err) => {
            if (err) {
              console.error('Failed to unlink temp file:', file.filepath, err)
            }
          })
        })
        return reject(
          new EntityError({
            errors: {
              image: {
                type: 'field',
                value: null,
                msg: MEDIAS_MESSAGES.ONLY_ONE_IMAGE_IS_ALLOWED,
                path: 'image',
                location: 'files'
              }
            }
          })
        )
      }
      const file = (files.image as File[])[0]
      const MAX_SIZE = 5000 * 1024 // 5 MB

      // Check file size
      if (file.size > MAX_SIZE) {
        fs.unlink(file.filepath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Failed to delete oversized upload:', file.filepath, unlinkErr)
          }
        })
        return reject(
          new EntityError({
            errors: {
              image: {
                type: 'field',
                value: file.originalFilename,
                msg: MEDIAS_MESSAGES.IMAGE_MUST_BE_LESS_THAN_5MB,
                path: 'image',
                location: 'files'
              }
            }
          })
        )
      }
      resolve(files.image as File[])
    })
  })
}
