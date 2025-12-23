import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.POSTGRES_CONNECTION_STRING ??
      "postgres://horizon:horizon@localhost:5432/horizon_indexer",
  },
} satisfies Config;
