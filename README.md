## Monday.com Business Intelligence Agent

A conversational BI agent for founders and executives that answers questions over your live Monday.com data. The agent calls the Monday GraphQL API at query time (no caching) and uses OpenAI with tool-calling to fetch, normalize, and analyze data from your Deals and Work Orders boards.

### 1. Setup

- **Install dependencies**

```bash
npm install
```

- **Create `.env.local`**

Copy `.env.local.example` to `.env.local` and fill in:

```bash
MONDAY_API_TOKEN=your_monday_token
DEALS_BOARD_ID=your_deals_board_id
WORK_ORDERS_BOARD_ID=your_work_orders_board_id
OPENAI_API_KEY=your_openai_key
```

- **Run the dev server**

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 2. Getting a Monday.com API token

1. Log into Monday.com as an admin.
2. Go to **Admin** -> **API** (or **Developers** -> **API** depending on your plan).
3. Generate a **personal API token**.
4. Paste the token as `MONDAY_API_TOKEN` in `.env.local`.

### 3. Finding board IDs

You need the IDs for:
- Deals Board (sales pipeline)
- Work Orders Board

To find an ID:

1. Open the board in Monday.com.
2. Look at the URL in your browser; it typically contains `boards/<BOARD_ID>`.
3. Copy the numeric ID and paste it into `.env.local` as `DEALS_BOARD_ID` or `WORK_ORDERS_BOARD_ID`.

### 4. Architecture overview

This app is built on **Next.js 14 App Router** with a React + Tailwind UI and a small set of server-side utilities. The frontend (`app/page.tsx` + `components/*`) provides a conversational chat interface, a left sidebar showing board connection status, and inline collapsible tool-call traces for each agent answer. The backend uses Next.js **API routes**: `app/api/chat/route.ts` orchestrates OpenAI (with tools defined in `lib/tools.ts` and client config in `lib/openai.ts`), executes live Monday.com GraphQL calls through `lib/monday.ts`, normalizes messy data via `lib/normalize.ts`, and returns both the final answer and structured tool traces to the UI. All Monday traffic is live (no caching), and there is a small `app/api/monday/route.ts` proxy if you want to call Monday directly from the browser.

### 5. Deploying to Vercel

1. Push this project to a Git repository (GitHub, GitLab, etc.).
2. Go to [Vercel](https://vercel.com) and create a new project from your repo.
3. Vercel will auto-detect **Next.js** and use `npm run build` as the build command.
4. In the Vercel project settings, set the same environment variables as in `.env.local`:

   - `MONDAY_API_TOKEN`
   - `DEALS_BOARD_ID`
   - `WORK_ORDERS_BOARD_ID`
   - `OPENAI_API_KEY`

5. Deploy. Once the build finishes, open the Vercel URL to use your hosted Monday BI Agent.

