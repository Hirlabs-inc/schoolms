/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Next.js image optimization (safe default for any hosting)
  images: {
    unoptimized: true,
  },
  // Baseline security headers. A strict Content-Security-Policy is intentionally
  // omitted (Next injects inline hydration scripts); add a nonce-based CSP at
  // the reverse proxy if you need one.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ]
  },
}

export default nextConfig
