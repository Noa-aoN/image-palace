import { ogAlt, ogSize, ogContentType, renderOgImage } from '@/lib/og'

export const alt = ogAlt
export const size = ogSize
export const contentType = ogContentType

export default function TwitterImage() {
  return renderOgImage()
}
