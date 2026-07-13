import { v4 as uuidv4 } from 'uuid'
export type UUIDv4 = string & { readonly __brand: 'uuidv4' }