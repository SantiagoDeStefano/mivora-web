import { NextFunction } from 'express-serve-static-core'
import { Request, Response } from 'express'
import { check, checkSchema } from "express-validator"
import HTTP_STATUS from "~/constants/httpStatus"
import { ORDERS_MESSAGE, TICKETS_MESSAGES } from "~/constants/messages"
import ErrorWithStatus from "~/models/Errors"
import { TokenPayload } from "~/models/requests/users.requests"
import databaseService from "~/services/database.services"
import { isValidUUIDv4 } from "~/utils/uuid"
import { validate } from "~/utils/validation"
import Order from '~/models/schemas/Order.schema'
import { OrderStatus } from '~/types/domain'

const order_status: OrderStatus[] = ['paid', 'canceled']

export const orderIdValidator = validate(
  checkSchema(
    {
      order_id: {
        custom: {
          options: async (values, { req }) => {
            if (!isValidUUIDv4(values)) {
              throw new ErrorWithStatus({
                status: HTTP_STATUS.BAD_REQUEST,
                message: ORDERS_MESSAGE.INVALID_ORDER_ID
              })
            }
            const orderResult = await databaseService.orders(
              `
                SELECT 
                  id
                FROM orders 
                WHERE id=$1
              `,
              [values]
            )
            if (orderResult.rows.length <= 0) {
              throw new ErrorWithStatus({
                status: HTTP_STATUS.NOT_FOUND,
                message: ORDERS_MESSAGE.ORDER_NOT_FOUND
              })
            }

            req.order = orderResult.rows
            return true
          }
        }
      }
    },
    ['params']
  )
)

export const orderOwnerValidator = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const ticketOwnerResult = await databaseService.tickets(`SELECT user_id FROM orders WHERE user_id=$1`, [user_id])
  if (ticketOwnerResult.rows.length <= 0) {
    return next(
      new ErrorWithStatus({
        message: ORDERS_MESSAGE.CURRENT_USER_IS_NOT_ORDER_OWNER,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

export const cancelOrderStatusValidator = async (req: Request, res: Response, next: NextFunction) => {
  const { id: order_id } = (req.order as Order[])[0]
  const ticket = await databaseService.orders(
    `
      SELECT tickets.status 
      FROM tickets 
      JOIN orders ON tickets.order_id=orders.id
      WHERE orders.id=$1
    `, 
    [order_id]
  )
  if (ticket.rows[0].status != 'booked') {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.ONLY_BOOKED_TICKETS_CAN_BE_CANCELED,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

export const orderStatusValidator = validate(
  checkSchema(
    {
      status: {
        optional: { options: { nullable: true } },
        isIn: {
          options: [order_status],
          errorMessage: ORDERS_MESSAGE.ORDER_STATUS_MUST_BE_PAID_OR_CANCELED
        }
      }
    }
  )
)