import { NextRequest } from "next/server";
import {
  getOpenAIClient,
  OPENAI_MODEL,
  SYSTEM_PROMPT,
  toolDefinitions
} from "@/lib/openai";
import { getBoardItems, searchBoardItems, getBoardColumns, getBoardGroups } from "@/lib/monday";
import {
  normalizeItems,
  type NormalizationSummary,
  type NormalizedItem
} from "@/lib/normalize";
import {
  computePipelineMetrics,
  extractFiltersFromQuery,
  type BIQueryFilters,
  type PipelineMetrics
} from "@/lib/bi";

export const runtime = "nodejs";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ToolCallTrace = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  endpoint: string;
  success: boolean;
  error?: string;
  rawSample?: unknown;
  normalizationSummary?: NormalizationSummary;
};

export type ChatResponse = {
  message: string;
  traces: ToolCallTrace[];
  suggestedFollowUps?: string[];
};

type LlmToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type LlmMessageParam =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: LlmToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type DeterministicBiResult = {
  filters: BIQueryFilters;
  metrics: PipelineMetrics;
  filteredCount: number;
};

function getLatestUserQuery(messages: ClientMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user" && messages[i].content.trim()) {
      return messages[i].content;
    }
  }
  return "";
}

function quarterLabel(quarter: { year: number; quarter: number }): string {
  return `Q${quarter.quarter} ${quarter.year}`;
}

function runDeterministicBiComputation(args: {
  query: string;
  normalizedItems: NormalizedItem[];
  summary: NormalizationSummary;
  traces: ToolCallTrace[];
  traceIdPrefix: string;
}): DeterministicBiResult {
  const { query, normalizedItems, summary, traces, traceIdPrefix } = args;

  const filters = extractFiltersFromQuery(query);

  traces.push({
    id: `${traceIdPrefix}-extract-filters`,
    name: "Extracting filters from query",
    args: { query },
    endpoint: "local deterministic BI layer",
    success: true,
    normalizationSummary: summary,
    rawSample: filters
  });

  if (filters.quarter) {
    traces.push({
      id: `${traceIdPrefix}-apply-quarter`,
      name: `Applying quarter filter: ${quarterLabel(filters.quarter)}`,
      args: { quarter: filters.quarter },
      endpoint: "local deterministic BI layer",
      success: true,
      normalizationSummary: summary
    });
  }

  if (filters.sector) {
    traces.push({
      id: `${traceIdPrefix}-apply-sector`,
      name: `Applying sector filter: ${filters.sector}`,
      args: { sector: filters.sector },
      endpoint: "local deterministic BI layer",
      success: true,
      normalizationSummary: summary
    });
  }

  if (filters.status) {
    traces.push({
      id: `${traceIdPrefix}-apply-status`,
      name: `Applying status filter: ${filters.status}`,
      args: { status: filters.status },
      endpoint: "local deterministic BI layer",
      success: true,
      normalizationSummary: summary
    });
  }

  const computed = computePipelineMetrics(normalizedItems, filters);

  traces.push({
    id: `${traceIdPrefix}-compute-metrics`,
    name: "Computing deterministic pipeline metrics",
    args: { filters },
    endpoint: "local deterministic BI layer",
    success: true,
    normalizationSummary: summary,
    rawSample: {
      metrics: computed.metrics,
      filteredCount: computed.filteredCount
    }
  });

  return {
    filters,
    metrics: computed.metrics,
    filteredCount: computed.filteredCount
  };
}

function parseToolArguments(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function isFunctionToolCall(value: unknown): value is LlmToolCall {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    id?: unknown;
    type?: unknown;
    function?: { name?: unknown; arguments?: unknown };
  };

  return (
    candidate.type === "function" &&
    typeof candidate.id === "string" &&
    typeof candidate.function?.name === "string" &&
    typeof candidate.function?.arguments === "string"
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
  }

  let openaiClient: ReturnType<typeof getOpenAIClient>;
  try {
    openaiClient = getOpenAIClient();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }

  const messages = body.messages as ClientMessage[];
  const latestUserQuery = getLatestUserQuery(messages);

  const llmMessages: LlmMessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content
  }));

  const traces: ToolCallTrace[] = [];

  // Tool-calling loop: OpenAI requests tools, we execute live Monday.com calls,
  // feed results back, and stop when a final assistant message is returned.
  // For safety we cap the loop to avoid runaway calls.
  let resultMessage: string | null = null;

  const toolLoopMessages: LlmMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...llmMessages
  ];

  for (let i = 0; i < 8; i += 1) {
    const response = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 4096,
      temperature: 0,
      tools: toolDefinitions,
      tool_choice: "auto",
      messages: toolLoopMessages as any
    });

    const assistantMessage = response.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error("OpenAI did not return an assistant message.");
    }

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (!toolCalls.length) {
      resultMessage = assistantMessage.content ?? "";
      break;
    }
    const functionToolCalls = toolCalls.filter(isFunctionToolCall);
    if (!functionToolCalls.length) {
      throw new Error("OpenAI returned tool calls in an unsupported format.");
    }

    const toolResults: { tool_call_id: string; output: unknown }[] = [];

    for (const toolCall of functionToolCalls) {
      const toolName = toolCall.function.name;
      let args: Record<string, unknown>;

      try {
        args = parseToolArguments(toolCall.function.arguments ?? "{}");
      } catch (err: unknown) {
        const parseError = err instanceof Error ? err.message : String(err);
        traces.push({
          id: toolCall.id,
          name: toolName,
          args: {},
          endpoint: "openai tool-calling",
          success: false,
          error: `Invalid tool arguments JSON: ${parseError}`
        });
        toolResults.push({
          tool_call_id: toolCall.id,
          output: { error: `Invalid tool arguments JSON: ${parseError}` }
        });
        continue;
      }

      const traceBase: ToolCallTrace = {
        id: toolCall.id,
        name: toolName,
        args,
        endpoint: "",
        success: false
      };

      try {
        if (toolName === "get_board_items") {
          const boardId = String(args.board_id);
          const limit = typeof args.limit === "number" ? args.limit : 100;
          const cursor = (args.cursor as string | null) ?? null;

          const itemsPage = await getBoardItems({
            boardId,
            limit,
            cursor
          });

          const { normalized, summary } = normalizeItems(itemsPage.items);
          traces.push({
            ...traceBase,
            endpoint: "monday.com GraphQL: boards.items_page",
            success: true,
            rawSample: itemsPage.items.slice(0, 3),
            normalizationSummary: summary
          });

          const bi = runDeterministicBiComputation({
            query: latestUserQuery,
            normalizedItems: normalized,
            summary,
            traces,
            traceIdPrefix: toolCall.id
          });

          toolResults.push({
            tool_call_id: toolCall.id,
            output: {
              board_id: boardId,
              cursor: itemsPage.cursor,
              filters: bi.filters,
              pipeline_metrics: bi.metrics,
              filtered_count: bi.filteredCount,
              normalization_summary: summary
            }
          });
        } else if (toolName === "search_board_items") {
          const boardId = String(args.board_id);
          const columnId =
            typeof args.column_id === "string" ? args.column_id : undefined;
          const value = String(args.value);

          const matches = await searchBoardItems({
            boardId,
            columnId,
            value
          });

          const { normalized, summary } = normalizeItems(matches);
          traces.push({
            ...traceBase,
            endpoint: "monday.com GraphQL: boards.items_page (search/filter)",
            success: true,
            rawSample: matches.slice(0, 3),
            normalizationSummary: summary
          });

          const bi = runDeterministicBiComputation({
            query: latestUserQuery,
            normalizedItems: normalized,
            summary,
            traces,
            traceIdPrefix: toolCall.id
          });

          toolResults.push({
            tool_call_id: toolCall.id,
            output: {
              board_id: boardId,
              filters: bi.filters,
              pipeline_metrics: bi.metrics,
              filtered_count: bi.filteredCount,
              normalization_summary: summary
            }
          });
        } else if (toolName === "get_board_columns") {
          const boardId = String(args.board_id);
          const cols = await getBoardColumns(boardId);

          traces.push({
            ...traceBase,
            endpoint: "monday.com GraphQL: boards.columns",
            success: true,
            rawSample: cols
          });

          toolResults.push({
            tool_call_id: toolCall.id,
            output: { columns: cols }
          });
        } else if (toolName === "get_board_groups") {
          const boardId = String(args.board_id);
          const groups = await getBoardGroups(boardId);

          traces.push({
            ...traceBase,
            endpoint: "monday.com GraphQL: boards.groups",
            success: true,
            rawSample: groups
          });

          toolResults.push({
            tool_call_id: toolCall.id,
            output: { groups }
          });
        } else {
          traces.push({
            ...traceBase,
            endpoint: "unknown",
            success: false,
            error: `Unknown tool: ${toolName}`
          });
          toolResults.push({
            tool_call_id: toolCall.id,
            output: { error: `Unknown tool: ${toolName}` }
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        traces.push({
          ...traceBase,
          endpoint: traceBase.endpoint || "monday.com GraphQL",
          success: false,
          error: message
        });
        toolResults.push({
          tool_call_id: toolCall.id,
          output: {
            error: "Monday.com API call failed. Please check env vars and network. " + message
          }
        });
      }
    }

    toolLoopMessages.push({
      role: "assistant",
      content: assistantMessage.content ?? "",
      tool_calls: functionToolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments ?? "{}"
        }
      }))
    });

    for (const tr of toolResults) {
      toolLoopMessages.push({
        role: "tool",
        tool_call_id: tr.tool_call_id,
        content: JSON.stringify(tr.output)
      });
    }
  }

  if (!resultMessage) {
    resultMessage =
      "I attempted several Monday.com API calls but could not reach a final answer within the tool-calling limit. Please try narrowing your question or rephrasing it.";
  }

  // One more small OpenAI call to suggest contextual follow-ups.
  let suggestedFollowUps: string[] | undefined;
  try {
    const followupResponse = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 150,
      temperature: 0,
      messages: [
        {
          role: "user",
          content:
            `BI answer:\n"""${resultMessage}"""\n\n` +
            "Based on this BI answer, suggest 2-3 short follow-up questions the founder might ask next. " +
            "Return ONLY a JSON array of strings, no other text."
        }
      ]
    });

    const followupText = followupResponse.choices?.[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(followupText);
      if (Array.isArray(parsed)) {
        suggestedFollowUps = parsed.filter((x) => typeof x === "string");
      }
    } catch {
      // If parsing fails, we silently ignore follow-ups.
    }
  } catch {
    // If the follow-up call itself fails, we still return the main answer.
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // First send traces and suggested follow-ups as a JSON payload prefix.
      const metaPayload = JSON.stringify({ traces, suggestedFollowUps });
      controller.enqueue(encoder.encode(`data: TRACES:${metaPayload}\n\n`));

      // Then stream the assistant message body. Here we send it as a single chunk,
      // but keeping the protocol chunk-based allows future incremental streaming.
      controller.enqueue(encoder.encode(`data: ${resultMessage}\n\n`));

      // Signal completion.
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
