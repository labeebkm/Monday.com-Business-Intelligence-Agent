import { useState } from "react";
import type { ToolCallTrace } from "@/app/api/chat/route";
import { cn } from "@/lib/utils";

type Props = {
  trace: ToolCallTrace;
};

export function ToolCallTraceCard({ trace }: Props) {
  const [open, setOpen] = useState(false);

  const normalized = trace.normalizationSummary;
  const fetched = normalized?.totalItems ?? 0;
  const nulls = normalized?.nullValues ?? 0;

  return (
    <div className="mt-2 rounded-md border border-gray-800 bg-card/80 text-xs text-gray-300">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-900/60"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex flex-col text-left">
          <span className="font-medium">
            <span className="mr-1">🔧</span>
            Tool Call: {trace.name}
          </span>
          <span className="text-[11px] text-gray-400">
            {trace.endpoint} · Fetched {fetched} items
            {normalized && ` | ${nulls} with null values normalized`}
          </span>
        </div>
        <span className="text-[11px] text-gray-400">{open ? "Hide" : "Expand"}</span>
      </button>
      {open && (
        <div className="border-t border-gray-800 px-3 py-2 space-y-2">
          <div>
            <div className="font-semibold mb-1">Parameters</div>
            <pre className="bg-black/40 rounded p-2 overflow-x-auto text-[11px]">
              {JSON.stringify(trace.args, null, 2)}
            </pre>
          </div>
          {normalized && (
            <div>
              <div className="font-semibold mb-1">Normalization summary</div>
              <pre className="bg-black/40 rounded p-2 overflow-x-auto text-[11px]">
                {JSON.stringify(normalized, null, 2)}
              </pre>
            </div>
          )}
          {trace.error && (
            <div className="text-red-400 text-[11px]">
              Error: {trace.error}. Check env vars or Monday.com configuration.
            </div>
          )}
          {trace.rawSample != null && (
            <details className={cn("text-[11px]")}>
              <summary className="cursor-pointer mb-1">
                View raw response sample (first few items)
              </summary>
              <pre className="bg-black/40 rounded p-2 overflow-x-auto mt-1">
                {JSON.stringify(trace.rawSample, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

