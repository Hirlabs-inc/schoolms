/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow TypeScript build even if there are errors
  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable Next.js image optimization (safe default for any hosting)
  images: {
    unoptimized: true,
  },
}

export default nextConfig
