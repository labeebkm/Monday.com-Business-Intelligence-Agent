export const mondayTools = [
  {
    name: "get_board_items",
    description: "Fetch all items from a Monday.com board with their column values",
    input_schema: {
      type: "object",
      properties: {
        board_id: { type: "string", description: "The Monday.com board ID" },
        limit: { type: "number", description: "Max items to fetch (default 100)" },
        cursor: { type: "string", description: "Pagination cursor" }
      },
      required: ["board_id"]
    }
  },
  {
    name: "search_board_items",
    description: "Search board items by column value or keyword",
    input_schema: {
      type: "object",
      properties: {
        board_id: { type: "string" },
        column_id: { type: "string" },
        value: { type: "string" }
      },
      required: ["board_id", "value"]
    }
  },
  {
    name: "get_board_columns",
    description: "Get the column structure/schema of a Monday.com board",
    input_schema: {
      type: "object",
      properties: {
        board_id: { type: "string" }
      },
      required: ["board_id"]
    }
  },
  {
    name: "get_board_groups",
    description: "Get groups/stages within a Monday.com board",
    input_schema: {
      type: "object",
      properties: {
        board_id: { type: "string" }
      },
      required: ["board_id"]
    }
  }
] as const;

export type MondayToolName = (typeof mondayTools)[number]["name"];

