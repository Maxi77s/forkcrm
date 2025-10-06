/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  images: {
    domains: [
      "localhost",
      "hebbkx1anhila5yf.public.blob.vercel-storage.com",
    ],
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
    ],
    unoptimized: true,
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  async rewrites() {
    const eBase = (process.env.ECOM_BASE_URL || "http://localhost:3002").replace(/\/+$/, "");
    const eChats = process.env.ECOM_CHATS_PATH || "/chat";
    const eWithLast = process.env.ECOM_CHATS_WITH_LAST_PATH || "/chat/with-last-message";

    const n8nBase = (process.env.N8N_BASE_URL || "").replace(/\/+$/, "");
    const nMsgs   = process.env.N8N_MESSAGES_PATH || "/webhook/mensajes";
    const nSend   = process.env.N8N_SEND_PATH || "/webhook/send-message";

    const rules = [
      { source: "/api/ecom/chats",              destination: `${eBase}${eChats}` },
      { source: "/api/ecom/chats-with-last",    destination: `${eBase}${eWithLast}` },
    ];
    if (n8nBase) {
      rules.push(
        { source: "/api/n8n/messages", destination: `${n8nBase}${nMsgs}` },
        { source: "/api/n8n/send",     destination: `${n8nBase}${nSend}` },
      );
    }
    return rules;
  },
};

module.exports = nextConfig;
