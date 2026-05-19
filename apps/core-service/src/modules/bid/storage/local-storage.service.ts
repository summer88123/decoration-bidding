// apps/bid-service/src/storage/local-storage.service.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { StorageService } from './storage.interface.js'

export class LocalStorageService implements StorageService {
  constructor(
    private readonly uploadDir: string,
    private readonly baseUrl: string,
  ) {}

  async save(file: Buffer, filename: string): Promise<string> {
    await fs.mkdir(this.uploadDir, { recursive: true })
    const fileKey = `${Date.now()}-${filename}`
    await fs.writeFile(path.join(this.uploadDir, fileKey), file)
    return fileKey
  }

  getUrl(fileKey: string): string {
    return `${this.baseUrl}/uploads/${fileKey}`
  }

  async delete(fileKey: string): Promise<void> {
    await fs.unlink(path.join(this.uploadDir, fileKey)).catch(() => {})
  }
}
