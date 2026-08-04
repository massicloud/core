# MassiCloud Landing

Marketing site for MassiCloud, built with Next.js 14 and `next-intl`.

## Default port

This project is configured to run on **port `3030`** by default so it does not conflict with the `portal` app if that one is already using `3000`.

## Run locally

```bash
cd /Users/kessar/massicloud/landing
npm install
npm run dev
```

Open:

```text
http://localhost:3030/fr
```

Other locales:

```text
http://localhost:3030/en
http://localhost:3030/ar
```

## Production check

```bash
cd /Users/kessar/massicloud/landing
npm run build
npm run start
```

## Included

- Localized landing pages for `fr`, `en`, and `ar`
- RTL support for Arabic
- Responsive navigation with mobile menu
- Page SEO metadata
- Open Graph and Twitter image routes
- Sitemap and robots routes
- SVG app icon and web manifest

