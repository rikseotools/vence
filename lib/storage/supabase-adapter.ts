import { getServiceClient } from '../api/shared/auth'
import type {
  StorageAdapter,
  UploadInput,
  UploadResult,
  DeleteInput,
  DeleteResult,
} from './types'

export class SupabaseStorageAdapter implements StorageAdapter {
  readonly provider = 'supabase' as const

  async upload(input: UploadInput): Promise<UploadResult> {
    const supabase = getServiceClient()
    const { error } = await supabase.storage
      .from(input.bucket)
      .upload(input.path, input.data, {
        cacheControl: input.cacheControl ?? '3600',
        upsert: input.upsert ?? false,
        contentType: input.contentType,
      })

    if (error) return { success: false, error: error.message }

    const {
      data: { publicUrl },
    } = supabase.storage.from(input.bucket).getPublicUrl(input.path)

    return { success: true, publicUrl, path: input.path }
  }

  async remove(input: DeleteInput): Promise<DeleteResult> {
    const supabase = getServiceClient()
    const { error } = await supabase.storage
      .from(input.bucket)
      .remove(input.paths)

    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  getPublicUrl(bucket: string, path: string): string {
    const supabase = getServiceClient()
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path)
    return publicUrl
  }
}
