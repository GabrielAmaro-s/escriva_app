import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Rotas antigas, de antes do vocabulário jurídico. Temporárias (307) enquanto o nome do produto não está definido.
  async redirects() {
    return [
      { source: "/visao-geral", destination: "/hoje", permanent: false },
      { source: "/campanhas", destination: "/consultivo", permanent: false },
      { source: "/tarefas", destination: "/prazos", permanent: false },
    ];
  },
};

export default nextConfig;
