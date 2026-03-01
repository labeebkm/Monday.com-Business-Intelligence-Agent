# Skylark Drones - Monday.com BI Agent

A conversational BI assistant for founders and executives. It answers natural-language questions using live Monday.com data from Deals and Work Orders boards.

## What It Does
- Uses tool-calling to query Monday.com GraphQL in real time (no caching).
- Computes deterministic pipeline metrics from normalized board data.
- Streams answers and tool traces to the UI.
- Loads board quick stats (rows/nulls) on page load, before any user question.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Groq SDK (`llama-3.3-70b-versatile`)
- Monday.com GraphQL API v2
- Tailwind CSS

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.local.example .env.local
```

Set these values in `.env.local`:
```env
MONDAY_API_TOKEN=your_monday_personal_api_token
DEALS_BOARD_ID=your_deals_board_numeric_id
WORK_ORDERS_BOARD_ID=your_work_orders_board_numeric_id
GROQ_API_KEY=your_groq_api_key
```

### 3. Get Monday.com token and board IDs
1. In Monday.com, go to your profile -> Administration -> API.
2. Generate a Personal API Token and set `MONDAY_API_TOKEN`.
3. Open each board URL and copy the numeric board ID:
   `monday.com/boards/1234567890`

### 4. Run locally
```bash
npm run dev
```
Open `http://localhost:3000`.

## Deploy to Vercel
1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add the 4 environment variables above.
4. Deploy.

## Architecture
```text
User query
  |
  v
POST /api/chat
  |
  +-> Groq chat completion tool loop (max 8 iterations)
  |     |
  |     +-> get_board_items    -> Monday GraphQL (all pages via getAllBoardItems)
  |     +-> search_board_items -> Monday GraphQL + local filter
  |     +-> get_board_columns  -> Monday GraphQL
  |     +-> get_board_groups   -> Monday GraphQL
  |
  +-> normalizeItems (currency/date/status/sector normalization)
  +-> computePipelineMetrics (deterministic metrics)
  |
  +-> SSE stream (traces + final answer)
```

## API Notes
- `get_board_items` fetches all pages until cursor is exhausted.
- `search_board_items` currently filters the fetched page and is best for lookup-style queries.
- Sidebar board connection dots use `/api/monday` health checks.
- Sidebar rows/nulls are prefetched at mount using `/api/chat`.

## Data Quality Handling
- Null value counting is included in trace summaries.
- Currency, date, status, and sector values are normalized before BI metrics.
- Responses include caveats when missing values are detected.
