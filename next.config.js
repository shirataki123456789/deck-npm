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
};

module.exports = nextConfig;