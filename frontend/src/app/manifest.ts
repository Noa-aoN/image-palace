import type { MetadataRoute } from 'next'
import { buildManifest } from '@/lib/pwa/manifest'

// 中身は lib 側に置く（テストから素で読めるようにするため）
export default function manifest(): MetadataRoute.Manifest {
  return buildManifest()
}
