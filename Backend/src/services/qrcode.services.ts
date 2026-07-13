import { envConfig } from '~/constants/config'
import { TokenType } from '~/constants/enums'
import { UUIDv4 } from '~/types/common'
import { signToken, verifyToken } from '~/utils/jwt'
import QRCodeLib from 'qrcode'

class QRCode {
  async createQrTicketToken(ticket_id: UUIDv4, event_id: UUIDv4, user_id: UUIDv4) {
    const signedQrToken = await this.signTicketQR({ ticket_id, event_id, user_id })
    return signedQrToken
  }
  async generateQrTicketCode(qr_code_token: string) {
    const qr_code = await QRCodeLib.toDataURL(qr_code_token)
    return qr_code
  }
  async verifyQrTicketToken(qr_code_token: string) {
    const decoded = await this.decodeTicketQR(qr_code_token)
    return decoded
  }
  private signTicketQR({ ticket_id, event_id, user_id }: { ticket_id: UUIDv4; event_id: UUIDv4; user_id: UUIDv4 }) {
    return signToken({
      payload: {
        ticket_id,
        event_id,
        user_id,
        tokenType: TokenType.QRCodeToken
      },
      privateKey: envConfig.jwtSecretQRCodeToken as string
    }) as Promise<string>
  }
  private decodeTicketQR(qr_code: string) {
    return verifyToken({
      token: qr_code,
      secretOrPublicKey: envConfig.jwtSecretQRCodeToken as string
    })
  }
}

const qrCode = new QRCode()
export default qrCode
