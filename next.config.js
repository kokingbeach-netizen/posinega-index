/** @type {import('next').NextConfig} */
const nextConfig = {
  // RSS fetchはサーバーサイドのみ
  serverExternalPackages: ["rss-parser"],
};

module.exports = nextConfig;