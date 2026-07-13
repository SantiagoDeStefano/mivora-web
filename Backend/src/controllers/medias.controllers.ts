import { NextFunction, Request, Response } from 'express'
import { MEDIAS_MESSAGES } from '~/constants/messages'
import mediasService from '~/services/medias.services'

export const uploadImageController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const url = await mediasService.uploadImage(req)
  res.json({
    message: MEDIAS_MESSAGES.IMAGE_UPLOAD_SUCCESS,
    result: url
  })
}