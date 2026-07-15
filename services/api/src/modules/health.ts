// Liveness probe only. Per CLAUDE.md this module must never carry health,
// clinical, or user data — it exists purely so orchestrators/load balancers
// can tell the process is up.

import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    status: "ok" as const,
    service: "t1dine-api",
    time: new Date().toISOString(),
  }));
}
