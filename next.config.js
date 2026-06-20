/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["lucide-react"],
  // Jangan redirect / → /dashboard di server: hash token reset email (#access_token) hilang.
  // app/page.jsx menangani redirect client-side.
};

module.exports = nextConfig;
