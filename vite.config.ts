import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/nova": {
        target: "https://api-nova-5yuwh.ondigitalocean.app",
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/api\/nova/,
            "/api/superchat/webhook-flowise",
          ),
      },
    },
  },
});
