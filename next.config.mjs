/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow TypeScript build even if there are errors
  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable Next.js image optimization for static export
  images: {
    unoptimized: true,
  },

  // (Optional) Base path for hosting
  // trailingSlash removed: it caused 308 redirects on API POSTs (e.g. /api/auth/login)
  // that dropped the request body in the browser, breaking login. This is a server app.
}

export default nextConfig
