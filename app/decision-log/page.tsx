export default function DecisionLogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6 text-gray-100">
          Decision Log — Monday.com BI Agent
        </h2>

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">
            1. Tech Stack Choices
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            <li>
              <strong>Next.js 14 App Router</strong>: chosen for seamless server/client
              split, API routes co-located with UI, and Vercel deployment simplicity.
            </li>
            <li>
              <strong>TypeScript</strong>: type safety across API boundaries (tool
              schemas, normalized data shapes).
            </li>
            <li>
              <strong>Tailwind CSS</strong>: rapid UI development with dark-theme utility
              classes.
            </li>
            <li>
              <strong>OpenAI (gpt-4o-mini)</strong>: strong tool-calling reliability and
              instruction-following for agentic BI tasks.
            </li>
            <li>
              <strong>No caching layer</strong>: assignment explicitly requires live data
              at query time, so every answer is based on fresh Monday.com calls.
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">
            2. Architecture Decisions
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            <li>
              <strong>Tool-calling loop (max 8 iterations)</strong>: allows the model to
              autonomously decide which boards and endpoints to query and in what order,
              instead of hardcoding query logic per question type.
            </li>
            <li>
              <strong>Server-side normalization</strong>: messy data is cleaned in
              `lib/normalize.ts` before being passed back to the LLM, reducing token usage
              and improving answer consistency.
            </li>
            <li>
              <strong>GraphQL over REST</strong>: Monday&apos;s v2 API is GraphQL; the app
              fetches only required fields (items, columns, groups) to keep payloads
              smaller and responses faster.
            </li>
            <li>
              <strong>Client-side search fallback</strong>: because Monday search has
              limitations, `searchBoardItems` fetches a page of items and filters
              client-side for predictable, schema-aware queries.
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">
            3. Data Quality Handling
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            <li>
              <strong>Null/missing values</strong>: counted in a normalization summary and
              surfaced to the LLM so answers can include explicit caveats about incomplete
              data.
            </li>
            <li>
              <strong>Currency normalization</strong>: strips symbols like `$` and `€`,
              removes thousand separators, and handles both text and numeric inputs so
              deal/work-order values can be aggregated reliably.
            </li>
            <li>
              <strong>Date normalization</strong>: accepts ISO strings as well as common
              variants like `DD/MM/YYYY`, `MM-DD-YYYY`, and `&quot;Month YYYY&quot;`,
              converting everything to ISO for consistent time-based analysis.
            </li>
            <li>
              <strong>Status normalization</strong>: lowercases and trims status/stage
              values to enable consistent grouping across slightly inconsistent labels.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-200 mb-2">
            4. Assumptions Made
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            <li>
              <strong>Stable board IDs</strong>: board IDs are assumed stable and provided
              via environment variables, not user-configurable at runtime.
            </li>
            <li>
              <strong>Deals board schema</strong>: expected to contain deal name,
              stage/status, value, sector, close date, and owner columns (with messy but
              recoverable formats).
            </li>
            <li>
              <strong>Work Orders board schema</strong>: expected to contain order name,
              client, status, value, sector, and assigned team or owner.
            </li>
            <li>
              <strong>Language</strong>: founders primarily ask questions in English; no
              multilingual support is required for this MVP.
            </li>
            <li>
              <strong>Pagination</strong>: a default page size of 100 items per fetch is
              sufficient for typical SMB Monday.com boards; very large tenants may need
              future pagination extensions.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

