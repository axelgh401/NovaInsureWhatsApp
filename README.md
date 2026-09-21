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
VITE_NOVA_ENDPOINT=/api/nova
VITE_NOVA_API_KEY=tu_api_key
```

No cambies `VITE_NOVA_ENDPOINT` cuando ejecutes la app con `pnpm dev`; debe permanecer como `/api/nova`.

## Desarrollo

```bash
pnpm dev
```

La aplicación permite simular conversaciones con un número de teléfono, visualizar las respuestas con formato estilo WhatsApp y exportar el historial como PNG o JPEG.

## Build

```bash
pnpm build
```
