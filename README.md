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

## Environment Variables

Copy `.env.example` and set these values in Netlify environment variables:

```bash
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
VITE_GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
```

Do not commit `.env.local`.

## Supabase

For a fresh Supabase project, run:

1. `SUPABASE_STEP_1A_BASE_TABLES.sql`
2. `SUPABASE_STEP_1B_OPERATION_TABLES.sql`
3. `SUPABASE_STEP_1C_INDEXES.sql`
4. `SUPABASE_STEP_2_FUNCTIONS.sql`
5. `SUPABASE_STEP_3_SEED_DATA_KOREAN_FIXED.sql`

For an existing project, use the patch files as needed.
