import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";

const BOT_ENDPOINT =
  "https://api-nova-5yuwh.ondigitalocean.app/api/superchat/webhook-flowise";
const BOT_TIMEOUT_MS = 285_000;

function getRequestId(request: VercelRequest) {
  const requestId = request.headers["x-request-id"];
  return typeof requestId === "string" && /^[a-z0-9-]{1,64}$/i.test(requestId)
    ? requestId
    : randomUUID();
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const requestId = getRequestId(request);
  response.setHeader("X-Request-ID", requestId);

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({
      error: "Method Not Allowed",
      source: "simulator",
      code: "METHOD_NOT_ALLOWED",
      requestId,
    });
  }

  const apiKey = process.env.NOVA_API_KEY;
  if (!apiKey) {
    return response.status(500).json({
      error: "NOVA_API_KEY no está configurada en Vercel.",
      source: "simulator",
      code: "SIMULATOR_CONFIGURATION_ERROR",
      requestId,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOT_TIMEOUT_MS);

  try {
    const botResponse = await fetch(BOT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });
    const contentType = botResponse.headers.get("content-type") || "";
    const responseText = await botResponse.text();
    let body: unknown = responseText;
    if (contentType.includes("application/json") && responseText) {
      try {
        body = JSON.parse(responseText);
      } catch {
        body = responseText;
      }
    }

    if (!botResponse.ok) {
      response.setHeader("X-Nova-Error-Source", "bot");
      response.setHeader("X-Nova-Upstream-Status", String(botResponse.status));
    }
    if (contentType) response.setHeader("Content-Type", contentType);
    return response.status(botResponse.status).send(body);
  } catch (error) {
    const timedOut = controller.signal.aborted;
    const detail = error instanceof Error ? error.message : String(error);
    const code = timedOut ? "BOT_TIMEOUT" : "BOT_CONNECTION_FAILED";
    const message = timedOut
      ? "El servicio del bot no respondió dentro de 4 minutos y 45 segundos."
      : "El servidor del simulador no pudo conectar con el servicio del bot.";

    console.error("[nova-proxy] Falló la solicitud al bot", {
      requestId,
      source: "bot",
      code,
      detail,
    });
    response.setHeader("X-Nova-Error-Source", "bot");
    return response.status(timedOut ? 504 : 502).json({
      error: message,
      message,
      source: "bot",
      code,
      requestId,
      detail,
    });
  } finally {
    clearTimeout(timeout);
  }
}
