/** @type {import('next').NextConfig} */
const nextConfig = {
  // 微服务 API 反向代理（开发时指向 gateway）
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
