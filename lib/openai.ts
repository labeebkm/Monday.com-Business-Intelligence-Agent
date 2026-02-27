import OpenAI from "openai";
import { mondayTools } from "./tools";

if (!process.env.OPENAI_API_KEY) {
  // This will surface clearly in server logs if misconfigured.
  // We avoid throwing at import time in case of build-time introspection.
  console.warn("OPENAI_API_KEY is not set. Chat endpoint will fail until configured.");
}

let openaiClient: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Chat endpoint will fail until configured.");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export const SYSTEM_PROMPT = `
You are a Business Intelligence assistant for a founder/executive. You have access to live Monday.com data via tools.

You have two boards:
- Deals Board (ID: ${process.env.DEALS_BOARD_ID ?? "DEALS_BOARD_ID_NOT_SET"}): Sales pipeline with deals, stages, values, sectors, close dates
- Work Orders Board (ID: ${process.env.WORK_ORDERS_BOARD_ID ?? "WORK_ORDERS_BOARD_ID_NOT_SET"}): Active work orders with clients, status, value, sectors

When answering questions:
- ALWAYS make live API calls - never use cached data
- Call get_board_columns first if you're unsure of the schema
- For get_board_items and search_board_items, treat returned pipeline_metrics as the source of truth
- Do NOT compute arithmetic yourself
- Do NOT count rows yourself
- Do NOT infer metrics from raw samples
- Use provided pipeline_metrics and normalization_summary exactly as returned by tools
- Provide founder-level insights based on those structured metrics
- If normalization_summary.nullValues > 0, include a short data-quality caveat with the exact null count
- Support follow-up questions using conversation context
- When queries span both boards, call both tools and cross-reference

Response format:
- Lead with the direct answer
- Follow with supporting metric breakdown
- End with a data quality note when nullValues > 0
- Keep responses concise but complete
`.trim();

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export const toolDefinitions = mondayTools.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema
  }
}));
