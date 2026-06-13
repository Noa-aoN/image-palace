import type { NextConfig } from "next"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"

// Content-Security-Policy。
// 注意: Next App Router はハイドレーション等でインラインスクリプト/スタイルを使うため
// script/style は 'unsafe-inline' を許容している（nonce ベースの厳格化は今後の課題）。
// それでも object/frame-ancestors/base-uri/connect の制限で XSS の被害面は縮小される。
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://image-palace-api.fly.dev https://*.sentry.io https://cloudflareinsights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const isProduction = process.env.NODE_ENV === "production"

const securityHeaders = [
  // CSP は本番のみ適用する。開発ではローカルAPI(localhost)や HMR（eval / ws）を
  // ブロックしてしまい、ログインなどが動かなくなるため出さない。
  ...(isProduction ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig

if (process.env.ENABLE_OPENNEXT_CLOUDFLARE_DEV === "1") {
  initOpenNextCloudflareForDev()
}
