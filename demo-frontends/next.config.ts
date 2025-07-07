import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow iframe embedding for app demos
  async headers() {
    return [
      {
        source: '/demos/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
  
  // Configure domains for Next.js Image component if needed
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3002',
        pathname: '/**',
      },
      // Add more ports as needed for other app demos
    ],
  },
};

export default nextConfig;
