import { NextRequest } from "next/server";

const MONDAY_API_URL = "https://api.monday.com/v2";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({
        error: "MONDAY_API_TOKEN is not set. Please configure your environment variables."
      }),
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);

  // Lightweight health check used by the sidebar to determine live connection status
  if (body && typeof body.boardKind === "string" && !body.query) {
    const boardKind = body.boardKind as "deals" | "work_orders";
    const boardId =
      boardKind === "deals"
        ? process.env.DEALS_BOARD_ID
        : boardKind === "work_orders"
        ? process.env.WORK_ORDERS_BOARD_ID
        : undefined;

    if (!boardId) {
      return new Response(
        JSON.stringify({ error: `Board ID env var missing for kind: ${boardKind}` }),
        { status: 500 }
      );
    }

    try {
      const res = await fetch(MONDAY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        },
        body: JSON.stringify({
          query: `query ($ids: [ID!]) { boards(ids: $ids) { id } }`,
          variables: { ids: [boardId] }
        })
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({
            error: "Monday.com API error during health check",
            status: res.status
          }),
          { status: 502 }
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: "Network error during Monday.com health check",
          detail: err?.message ?? String(err)
        }),
        { status: 502 }
      );
    }
  }

  if (!body || typeof body.query !== "string") {
    return new Response(JSON.stringify({ error: "Missing GraphQL query in body" }), {
      status: 400
    });
  }

  try {
    const res = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({ query: body.query, variables: body.variables ?? {} })
    });

    const json = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: "Monday.com API error",
          status: res.status,
          body: json
        }),
        { status: 502 }
      );
    }

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Network error calling Monday.com API",
        detail: err?.message ?? String(err)
      }),
      { status: 502 }
    );
  }
}

