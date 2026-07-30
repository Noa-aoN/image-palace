import type { NextConfig } from "next"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
import { buildContentSecurityPolicy, securityHeaders as baseSecurityHeaders } from "./src/lib/security/csp"

const isProduction = process.env.NODE_ENV === "production"

const securityHeaders = [
  // CSP は本番のみ適用する。開発ではローカルAPI(localhost)や HMR（eval / ws）を
  // ブロックしてしまい、ログインなどが動かなくなるため出さない。
  ...(isProduction ? [{ key: "Content-Security-Policy", value: buildContentSecurityPolicy() }] : []),
  ...baseSecurityHeaders,
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
  // 旧URL /collections を /boxes へ（「コレクション」→「ボックス」改名の後方互換）。
  async redirects() {
    return [
      { source: "/collections", destination: "/boxes", permanent: false },
      { source: "/collections/:path*", destination: "/boxes/:path*", permanent: false },
    ]
  },
}

export default nextConfig

if (process.env.ENABLE_OPENNEXT_CLOUDFLARE_DEV === "1") {
  initOpenNextCloudflareForDev()
}
