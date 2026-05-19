// apps/bid-service/src/storage/storage.factory.ts
import { LocalStorageService } from './local-storage.service.js'
import type { StorageService } from './storage.interface.js'

export function createStorageService(
  driver: string,
  uploadDir: string,
  baseUrl: string,
): StorageService {
  if (driver === 'local') return new LocalStorageService(uploadDir, baseUrl)
  // TODO: S3StorageService
  throw new Error(`Unknown storage driver: ${driver}`)
}
