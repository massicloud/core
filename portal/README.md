# MassiCloud Portal

Dark-themed Next.js 14 portal for MassiCloud, the Algerian sovereign cloud platform.

## Features

- Managed Postgres and Redis dashboards
- Live API-backed instance lists, create flows, and delete confirmations
- Settings screen for API endpoint testing
- Algerian cultural styling with a subtle Zellij sidebar texture

## Environment

Set the API endpoint in `portal/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Validation

```bash
npm run lint
npm run build
```
