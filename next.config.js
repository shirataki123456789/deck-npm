/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.onepiece-cardgame.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'onepiece-cardgame.com',
        pathname: '/images/**',
      },
    ],
  },
  // Vercel serverless function timeout (Pro plan: 60s, Hobby: 10s)
  serverExternalPackages: ['sharp'],
};

module.exports = nextConfig;
