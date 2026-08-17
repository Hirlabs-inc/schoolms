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

  // Static export: emits a deployable `out/` folder (pages only).
  // API routes are NOT exported by Next — they live as Netlify Functions under
  // netlify/functions/ and are mapped from /api/* via netlify.toml redirects.
  // This keeps the DB token + JWT secret server-side while the UI is static.
  output: 'export',
}

export default nextConfig
