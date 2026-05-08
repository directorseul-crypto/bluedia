# BLUEDIA COFFEE Coupon Web App

BLUEDIA COFFEE mobile coupon, roulette, staff, and admin MVP.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Netlify

Use this repository as the Netlify source.

Build settings:

```text
Build command: npm run build
Publish directory: dist
```

## Environment Variables

Set these in Netlify environment variables:

```bash
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
VITE_GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
```

Do not commit `.env.local`.

## Supabase

Run the Supabase SQL files from the deployment backup package before using the production site. The app expects Supabase RPC functions and tables to be installed first.
