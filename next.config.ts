import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack instead of Turbopack for better compatibility with pdf-parse
  // You can also run with: npm run dev -- --webpack
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
  // Add empty turbopack config to silence the warning, or use webpack flag
  turbopack: {},
  
  // CORS headers for Chrome extension
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-OpenAI-API-Key' },
        ],
      },
    ];
  },
};

export default nextConfig;
