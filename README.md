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

La aplicación permite simular conversaciones con un número de teléfono, visualizar las respuestas con formato estilo WhatsApp y exportar el historial como PNG o JPEG.

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
