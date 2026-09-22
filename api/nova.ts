import type { VercelRequest, VercelResponse } from "@vercel/node";

const BOT_ENDPOINT =
  "https://api-nova-5yuwh.ondigitalocean.app/api/superchat/webhook-flowise";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.NOVA_API_KEY;
  if (!apiKey) {
    return response.status(500).json({
      error: "NOVA_API_KEY no está configurada en Vercel.",
    });
  }

  try {
    const botResponse = await fetch(BOT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(request.body),
    });
    const contentType = botResponse.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await botResponse.json()
      : await botResponse.text();

    return response.status(botResponse.status).send(body);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "No fue posible contactar al bot.";
    return response.status(502).json({ error: detail });
  }
}
