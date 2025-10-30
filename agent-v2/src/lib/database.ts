import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

let client: Client | null = null;
let initErrorLogged = false;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(moduleDir, "../../mastra.db");

const resolveLibsqlUrl = () =>
  process.env.LIBSQL_DB_URL || `file:${defaultDbPath}`;

export const getLibsqlClient = (): Client | null => {
  if (client) {
    return client;
  }

  try {
    client = createClient({
      url: resolveLibsqlUrl(),
      authToken: process.env.LIBSQL_DB_AUTH_TOKEN,
    });

    return client;
  } catch (error) {
    if (!initErrorLogged) {
      console.warn("[libsql] Falling back to in-memory cache", {
        error: error instanceof Error ? error.message : error,
      });
      initErrorLogged = true;
    }
    return null;
  }
};
