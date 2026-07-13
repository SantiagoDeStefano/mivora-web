import { v4 as uuidv4 } from 'uuid'
import { validate as uuidValidate, version as uuidVersion } from 'uuid'
import { UUIDv4 } from '~/types/common'

export const newUUIDv4 = (): UUIDv4 => uuidv4() as UUIDv4
export function isValidUUIDv4(value: unknown): value is UUIDv4 {
  return (
    typeof value === 'string' &&
    uuidValidate(value) &&
    uuidVersion(value) === 4
  )
}