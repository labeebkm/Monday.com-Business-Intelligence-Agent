const MONDAY_API_URL = "https://api.monday.com/v2";

export type MondayColumnValue = {
  id: string;
  text: string | null;
  value: string | null;
  column: {
    title: string;
    type: string;
  };
};

export type MondayItem = {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
  group: {
    title: string;
  } | null;
};

export type MondayItemsPage = {
  cursor: string | null;
  items: MondayItem[];
};

export type MondayBoardItemsResponse = {
  boards: {
    items_page: MondayItemsPage;
  }[];
};

export type MondayBoardColumnsResponse = {
  boards: {
    columns: {
      id: string;
      title: string;
      type: string;
    }[];
  }[];
};

export type MondayBoardGroupsResponse = {
  boards: {
    groups: {
      id: string;
      title: string;
    }[];
  }[];
};

type FetchOptions = {
  query: string;
  variables?: Record<string, unknown>;
};

const MAX_RETRIES = 3;

async function mondayFetch<T>({ query, variables }: FetchOptions): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    throw new Error("MONDAY_API_TOKEN is not set. Please configure your environment variables.");
  }

  let attempt = 0;
  let delay = 500;

  // Simple exponential backoff on 429 / 5xx
  // Always live - no caching
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({ query, variables })
    });

    if (res.ok) {
      const json = await res.json();
      if (json.errors && json.errors.length) {
        throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`);
      }
      return json.data as T;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
      delay *= 2;
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(`Monday API request failed with status ${res.status}: ${text}`);
  }
}

export async function getBoardItems(args: {
  boardId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<MondayItemsPage> {
  const { boardId, limit = 100, cursor } = args;

  const query = `
    query GetBoardItems($boardId: [ID!], $limit: Int!, $cursor: String) {
      boards(ids: $boardId) {
        items_page(limit: $limit, cursor: $cursor) {
          cursor
          items {
            id
            name
            column_values {
              id
              text
              value
              column {
                title
                type
              }
            }
            group {
              title
            }
          }
        }
      }
    }
  `;

  const data = await mondayFetch<MondayBoardItemsResponse>({
    query,
    variables: { boardId: boardId, limit, cursor }
  });

  const board = data.boards?.[0];
  if (!board) {
    throw new Error(`Board ${boardId} not found. Check your board ID and env vars.`);
  }

  return board.items_page;
}

export async function getAllBoardItems(args: {
  boardId: string;
}): Promise<MondayItem[]> {
  const { boardId } = args;
  const allItems: MondayItem[] = [];
  let cursor: string | null = null;

  do {
    const page = await getBoardItems({ boardId, limit: 100, cursor });
    allItems.push(...page.items);
    cursor = page.cursor;
  } while (cursor);

  return allItems;
}

export async function searchBoardItems(args: {
  boardId: string;
  columnId?: string;
  value: string;
}): Promise<MondayItem[]> {
  const { boardId, columnId, value } = args;

  // Monday's search is somewhat limited; we use items_page + client-side filter
  // to keep behavior predictable for the agent.
  const page = await getBoardItems({ boardId, limit: 100 });
  const needle = value.toLowerCase();

  return page.items.filter((item) =>
    item.column_values.some((cv) => {
      if (columnId && cv.id !== columnId) return false;
      const text = (cv.text ?? "").toLowerCase();
      return text.includes(needle);
    })
  );
}

export async function getBoardColumns(boardId: string) {
  const query = `
    query GetBoardColumns($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns {
          id
          title
          type
        }
      }
    }
  `;

  const data = await mondayFetch<MondayBoardColumnsResponse>({
    query,
    variables: { boardId }
  });

  const board = data.boards?.[0];
  if (!board) {
    throw new Error(`Board ${boardId} not found when fetching columns.`);
  }

  return board.columns;
}

export async function getBoardGroups(boardId: string) {
  const query = `
    query GetBoardGroups($boardId: [ID!]) {
      boards(ids: $boardId) {
        groups {
          id
          title
        }
      }
    }
  `;

  const data = await mondayFetch<MondayBoardGroupsResponse>({
    query,
    variables: { boardId }
  });

  const board = data.boards?.[0];
  if (!board) {
    throw new Error(`Board ${boardId} not found when fetching groups.`);
  }

  return board.groups;
}
