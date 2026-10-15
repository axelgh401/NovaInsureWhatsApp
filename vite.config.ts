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
          timeout: 300_000,
          proxyTimeout: 295_000,
          headers: {
            "X-API-Key": env.NOVA_API_KEY || "",
          },
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyRequest) => {
              proxyRequest.setTimeout(285_000, () => {
                const timeoutError = Object.assign(
                  new Error("El servicio del bot superó el límite de 4 minutos y 45 segundos."),
                  { code: "ETIMEDOUT" },
                );
                proxyRequest.destroy(timeoutError);
              });
            });
            proxy.on("error", (error, request, response) => {
              const errorCode =
                "code" in error && typeof error.code === "string" ? error.code : "";
              const timedOut = errorCode === "ETIMEDOUT" || errorCode === "ESOCKETTIMEDOUT";
              const requestId = request.headers["x-request-id"];
              const status = timedOut ? 504 : 502;
              const code = timedOut ? "BOT_TIMEOUT" : "BOT_CONNECTION_FAILED";
              const message = timedOut
                ? "El servicio del bot no respondió dentro de 4 minutos y 45 segundos."
                : "El servidor de desarrollo no pudo conectar con el servicio del bot.";

              console.error("[nova-dev-proxy] Falló la solicitud al bot", {
                requestId,
                source: "bot",
                code,
                detail: error.message,
              });
              if (!("writeHead" in response)) return;
              if (response.headersSent || response.destroyed) return;
              response.writeHead(status, {
                "Content-Type": "application/json",
                "X-Nova-Error-Source": "bot",
                "X-Request-ID": Array.isArray(requestId) ? requestId[0] : requestId || "",
              });
              response.end(
                JSON.stringify({
                  error: message,
                  message,
                  source: "bot",
                  code,
                  requestId,
                  detail: error.message,
                }),
              );
            });
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
