# Skylark Drones — Monday.com BI Agent

A conversational Business Intelligence agent for founders and executives. Answers natural-language questions over live Monday.com data — Deals pipeline and Work Orders — with no cached responses.

## Tech Stack
- **Next.js 14** (App Router) — full-stack React with co-located API routes
- **TypeScript** — end-to-end type safety across tool schemas and normalized data
- **OpenAI GPT-4o-mini** — tool-calling loop for agentic BI queries
- **Monday.com GraphQL API v2** — live data, no caching, exponential backoff on rate limits
- **Tailwind CSS** — dark-theme UI
- **Vercel** — zero-config deployment

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:
MONDAY_API_TOKEN=your_monday_personal_api_token
DEALS_BOARD_ID=your_deals_board_numeric_id
WORK_ORDERS_BOARD_ID=your_work_orders_board_numeric_id
OPENAI_API_KEY=your_openai_api_key

### 3. Get your Monday.com API token
1. Log in to Monday.com → click your avatar → **Administration**
2. Go to **API** section → generate a **Personal API Token**
3. Paste it as `MONDAY_API_TOKEN`

### 4. Get Board IDs
Open each board in Monday.com. The numeric ID is in the URL:
`monday.com/boards/`**`1234567890`**

### 5. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel
1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Add the 4 environment variables in Vercel project settings
4. Deploy — Vercel auto-detects Next.js

## Architecture
User query
│
▼
Next.js API Route (/api/chat)
│
├─► OpenAI tool-calling loop (max 8 iterations)
│       │
│       ├─► get_board_items    → Monday.com GraphQL (live)
│       ├─► search_board_items → Monday.com GraphQL (live)
│       ├─► get_board_columns  → Monday.com GraphQL (live)
│       └─► get_board_groups   → Monday.com GraphQL (live)
│
├─► lib/normalize.ts  — cleans ₹ currency, dates, statuses, nulls
├─► lib/bi.ts         — deterministic pipeline metrics + filter extraction
│
└─► SSE stream → ChatInterface.tsx (traces + answer)

## Sectors Supported
Mining · Powerline · Renewables · Railways · Construction · DSP · Aviation · Security & Surveillance · Tender · Manufacturing

## Data Quality Handling
- ₹ Indian Rupee currency parsing (masked values in crores/lakhs)
- ~52% of open deals have missing values — surfaced as explicit caveats
- Date normalization across ISO, DD/MM/YYYY, MM-DD-YYYY formats
- Status/stage normalization (case-insensitive, trimmed)
- Null value counting reported in every tool trace
