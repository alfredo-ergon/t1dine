# T1Dine API — container image for Azure Container Apps (or any container host).
# Runs services/api directly with tsx (TypeScript at runtime; no build step).
#
# Build context is the repo root (pnpm monorepo). Only the API's dependency
# subtree is installed — not the mobile/admin app deps — via pnpm's filter.
FROM node:22-slim

ENV NODE_ENV=production
# Enable pnpm via corepack (version pinned by root package.json "packageManager").
RUN corepack enable

WORKDIR /app

# Copy the monorepo (exclusions in .dockerignore) and install ONLY the API and
# its workspace dependencies (@t1dine/domain, food-schema, nutrition) + their
# externals. The public npm registry is used (the MS proxy is a local-dev-only
# env var, not baked into .npmrc), which Azure's build environment can reach.
COPY . .
RUN pnpm install --frozen-lockfile --filter "@t1dine/api..."

# The server binds 0.0.0.0 and reads PORT (default 3001). Container Apps sets the
# ingress target port; keep --target-port aligned with this.
EXPOSE 3001
CMD ["pnpm", "--filter", "@t1dine/api", "start"]
