# NovaInsureWhatsApp

Simulador de conversaciones de WhatsApp para probar el chatbot de Nova Insure.

## Requisitos

- Node.js
- pnpm

## Instalación

```bash
pnpm install
```

Configura las variables de entorno en `.env.local`:

```env
VITE_NOVA_ENDPOINT=/api/nova
VITE_NOVA_API_KEY=tu_api_key
```

## Desarrollo

```bash
pnpm dev
```

La aplicación permite simular conversaciones con un número de teléfono, visualizar las respuestas con formato estilo WhatsApp y exportar el historial como PNG o JPEG.

## Build

```bash
pnpm build
```
