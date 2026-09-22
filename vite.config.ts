import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/nova": {
          target: "https://api-nova-5yuwh.ondigitalocean.app",
          changeOrigin: true,
          headers: {
            "X-API-Key": env.NOVA_API_KEY || "",
          },
          rewrite: (path) =>
            path.replace(
              /^\/api\/nova/,
              "/api/superchat/webhook-flowise",
            ),
        },
      },
    },
  };
});
