import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nabh/shared'],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    // Proxy browser calls to the API server-side, so no API host is ever baked
    // into the client bundle and there is no cross-origin request.
    //   - Production (Render): set API_PROXY_TARGET to the API service URL.
    //   - Local dev: defaults to the local API on :4000.
    const target = process.env.API_PROXY_TARGET || 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
      { source: '/uploads/:path*', destination: `${target}/uploads/:path*` },
      { source: '/socket.io/:path*', destination: `${target}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
