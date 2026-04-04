import type { NextConfig } from "next"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"

const nextConfig: NextConfig = {}

export default nextConfig

if (process.env.ENABLE_OPENNEXT_CLOUDFLARE_DEV === "1") {
  initOpenNextCloudflareForDev()
}
