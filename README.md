# NovaInsureWhatsApp

Simulador de conversaciones de WhatsApp para probar el chatbot de Nova Insure.

## Requisitos

- Node.js
- pnpm

## Instalación

```bash
pnpm install
```

Vite utiliza un proxy local para evitar CORS durante el desarrollo. Crea tu archivo local a partir del ejemplo:

```bash
cp .env.example .env.local
```

Después abre `.env.local` y configura tu API key:

```env
NOVA_API_KEY=tu_api_key
```

La variable `NOVA_API_KEY` se utiliza únicamente en el proxy local y en la función serverless de Vercel. No se expone al navegador ni debe publicarse en Git.

## Desarrollo

```bash
pnpm dev
```

La aplicación permite simular conversaciones con un número de teléfono, visualizar las respuestas con formato estilo WhatsApp y guardar el historial como PNG, JPEG o TXT. También puede exportar la conversación junto con el panel completo de tracking en PNG, o generar un TXT con la transcripción, métricas por turno y snapshot JSON. El panel de métricas registra por cada respuesta el estado HTTP, latencia real, estado reportado por la API, agente, intención, fase, atención humana y `sessionId`; también resume errores, escalaciones, agentes observados y latencia promedio. Si el endpoint omite un campo, la interfaz lo muestra como no reportado en lugar de inferirlo.

El selector incluye 4 perfiles de Cliente y 8 de No Cliente del catálogo de pruebas, agrupados junto con la opción Custom para números libres. Al seleccionar un perfil de prueba se muestran etiquetas para la rama y el universo; el universo se puede cambiar entre las opciones asignadas a ese perfil. El encabezado muestra el estado del proxy y la protección de la clave junto a Nova Bot.

### Automatización RPA

Los controles principales exponen identificadores estables (`data-testid`):

- `profile-select`, `custom-phone-input`
- `profile-branch-tag`, `profile-universe-select`
- `message-input`, `send-message`
- `attach-audio`, `audio-file-input`
- `attach-image`, `image-file-input`
- `conversation-messages`, `conversation-message`
- `clear-conversation`
- `save-conversation-png`, `save-conversation-jpeg`, `save-conversation-txt`
- `save-conversation-tracking-png`, `save-conversation-tracking-txt`
- `conversation-metrics`, `conversation-tracking-json`
- `metric-turn-count`, `metric-api-result`, `metric-human-attention`, `metric-average-latency`
- `tracked-turn`, `turn-http-status`, `turn-agent`, `turn-phase`, `turn-intent`
- `turn-human-attention`, `turn-latency`, `turn-question`, `turn-response`, `turn-session-id`

`conversation-tracking-json` es el contrato RPA recomendado: contiene un snapshot JSON con `schemaVersion`, el perfil, los contadores agregados y todos los turnos. Cada turno tiene `status` (`pending`, `success`, `failed` o `unverified`), ID de correlación, pregunta, respuesta, timestamps, latencia en milisegundos, HTTP, estado API, agente, intención, fase, atención humana, sesión y error. Los datos omitidos por la API son `null`; no se deben inferir.

Las exportaciones combinadas se identifican como `save-conversation-tracking-png` (chat completo y panel de métricas en una imagen lateral) y `save-conversation-tracking-txt` (transcripción, resumen, desglose por turno y snapshot JSON).

Ejemplo con Playwright:

```js
const snapshotText = await page.getByTestId("conversation-tracking-json").textContent();
const tracking = JSON.parse(snapshotText ?? "{}");
const failedTurns = tracking.turns.filter((turn) => turn.status === "failed");
console.log(tracking.summary, failedTurns);
```

Como alternativa, cada tarjeta `tracked-turn` expone esos valores en atributos `data-*` y selectores por campo para lectura incremental. Espera a que el turno deje de estar `pending` antes de evaluarlo. Al limpiar la conversación, se limpian tanto las métricas visibles como el snapshot.

Audio e imagen se pueden seleccionar y previsualizar en la conversación, pero actualmente son adjuntos locales de simulación y no se envían a la API del bot. Solo se aceptan tipos MIME `audio/*` e `image/*`.

## Build

```bash
pnpm build
```

## Despliegue en Vercel

Importa este repositorio en Vercel y agrega la variable de entorno `NOVA_API_KEY` en
**Settings → Environment Variables** para los entornos que utilizarás
(Production, Preview y/o Development). Después despliega nuevamente.

Usa exactamente este nombre:

```text
NOVA_API_KEY
```

No uses `VITE_NOVA_API_KEY`, `VITE_NOVA_ENDPOINT` ni ningún prefijo público.
La API key no se incluye en el repositorio.

La función [`api/nova.ts`](./api/nova.ts) agrega la API key en el servidor y reenvía
la solicitud al bot. Esto evita CORS y mantiene la credencial privada.
