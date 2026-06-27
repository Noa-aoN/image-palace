import type { MetadataRoute } from 'next'
import { SITE_URL, PRIVATE_PATHS } from '@/lib/site'

// /robots.txt を生成する（Next.js メタデータ規約）。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 認証が必要な画面はクロール対象外（薄いログイン後ページのインデックスを防ぐ）
      disallow: [...PRIVATE_PATHS],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
