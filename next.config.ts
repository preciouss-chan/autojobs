import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack config for pdf-parse and canvas
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize pdf-parse and canvas for server-side only
      config.externals = config.externals || [];
      config.externals.push({
        canvas: "commonjs canvas",
        "pdf-parse": "commonjs pdf-parse",
      });
    }
    return config;
  },

  // Keep Turbopack empty to avoid conflicts
  turbopack: {},

  // Security headers and CORS configuration
  async headers() {
    // Get allowed origins from environment or use sensible defaults
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [
          "https://autojobs.app",
          "https://www.autojobs.app",
          process.env.CHROME_EXTENSION_ID ? `chrome-extension://${process.env.CHROME_EXTENSION_ID}` : null,
        ].filter(Boolean);

    return [
      {
        source: '/api/:path*',
        headers: [
          // Security headers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // CORS headers - only allow specific origins
          { 
            key: 'Access-Control-Allow-Origin', 
            value: process.env.NODE_ENV === "production" 
              ? allowedOrigins.join(", ")
              : "*" // Allow all in development
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-OpenAI-API-Key' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
      // Apply security headers to all routes
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
