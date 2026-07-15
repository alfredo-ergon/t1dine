// Admin-managed AI configuration: lets an admin set the Anthropic API key +
// model for `POST /admin/foods/ai-generate` from the backoffice instead of
// only via the `ANTHROPIC_API_KEY`/`FOODAI_MODEL` environment variables. See
// `../aiProviderResolution.ts` for how this stored config is combined with
// the environment at request time (resolved fresh on every AI-generate
// call, never cached), and `../aiConfigCrypto.ts` for how the key is
// encrypted at rest.
//
// Every route in this file requires `requireAdmin` (see `./admin.ts`) — same
// 401 (unauthenticated) / 403 (authenticated, non-admin) contract as every
// other admin route.
//
// PRIVACY / GOVERNANCE: the raw/decrypted API key NEVER appears in any
// response from this module. `keyMasked` is built ENTIRELY from the stored
// `keyLast4` — this module never decrypts `encryptedKey` just to build a
// display value. Nothing here is logged.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { encryptSecret, resolveSettingsSecret } from "../aiConfigCrypto.js";
import type { SettingsRepository, StoredAiConfig } from "../repositories/settingsRepository.js";
import type { UserRepository } from "../repositories/userRepository.js";
import { requireAdmin } from "./admin.js";

/** Anthropic model ids offered to an admin. Keep in sync with whatever
 * `AnthropicFoodAiProvider`/`../aiProviderResolution.ts` is expected to
 * support. */
export const AVAILABLE_AI_MODELS: readonly string[] = ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"];

/** Must match `../aiProviderResolution.ts`'s `DEFAULT_MODEL`. */
const DEFAULT_MODEL = "claude-opus-4-8";

export type EffectiveAiSource = "admin" | "env" | "none";

export interface AiConfigView {
  provider: "anthropic";
  enabled: boolean;
  model: string;
  keySet: boolean;
  keyMasked: string | null;
  availableModels: readonly string[];
  effectiveSource: EffectiveAiSource;
  updatedAt: string | null;
}

/**
 * Pure: builds the `GET`/`PUT /admin/ai-config` response shape from a stored
 * config (or `null` when none has ever been saved) and whether
 * `ANTHROPIC_API_KEY` is currently set in the environment. NEVER decrypts
 * `encryptedKey` — `keyMasked` is built entirely from `keyLast4`.
 */
export function buildAiConfigView(stored: StoredAiConfig | null, envApiKeySet: boolean): AiConfigView {
  const enabled = stored?.enabledFlag ?? false;
  const model = stored?.model ?? DEFAULT_MODEL;
  const keySet = Boolean(stored?.encryptedKey);
  const keyMasked = stored?.keyLast4 ? `sk-ant-••••${stored.keyLast4}` : null;

  // "admin" requires BOTH enabled and an actually-present key — never report
  // "admin" from a stale `enabledFlag: true` with no key (see the PUT
  // handler's clear-implies-disable invariant below).
  const effectiveSource: EffectiveAiSource = enabled && keySet ? "admin" : envApiKeySet ? "env" : "none";

  return {
    provider: "anthropic",
    enabled,
    model,
    keySet,
    keyMasked,
    availableModels: AVAILABLE_AI_MODELS,
    effectiveSource,
    updatedAt: stored?.updatedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Request contract
// ---------------------------------------------------------------------------

const putAiConfigBodySchema = z.object({
  apiKey: z.string({ invalid_type_error: "apiKey must be a string or null" }).nullable().optional(),
  model: z
    .string({ invalid_type_error: "model must be a string" })
    .trim()
    .min(1, "model must be a non-empty string")
    .optional(),
  enabled: z.boolean({ invalid_type_error: "enabled must be a boolean" }).optional(),
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface AiConfigAdminDeps {
  settingsRepository: SettingsRepository;
  userRepository: UserRepository;
  secret: string;
  adminEmails: string[];
}

export function aiConfigRoutes(deps: AiConfigAdminDeps) {
  const adminPreHandler = requireAdmin({
    secret: deps.secret,
    userRepository: deps.userRepository,
    adminEmails: deps.adminEmails,
  });

  return async function registerAiConfigRoutes(app: FastifyInstance): Promise<void> {
    app.get("/admin/ai-config", { preHandler: adminPreHandler }, async (_request, reply) => {
      const stored = await deps.settingsRepository.getAiConfig();
      return reply.send(buildAiConfigView(stored, Boolean(process.env["ANTHROPIC_API_KEY"])));
    });

    app.put("/admin/ai-config", { preHandler: adminPreHandler }, async (request, reply) => {
      const parsedBody = putAiConfigBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "AI config request body failed validation.",
          issues: parsedBody.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
        });
      }

      const { apiKey, model, enabled } = parsedBody.data;

      if (model !== undefined && !AVAILABLE_AI_MODELS.includes(model)) {
        return reply.status(400).send({
          error: "invalid_model",
          message: `model must be one of: ${AVAILABLE_AI_MODELS.join(", ")}.`,
        });
      }

      const existing = await deps.settingsRepository.getAiConfig();

      // Resolve encryptedKey/keyLast4 from the `apiKey` field's three cases:
      // non-empty string -> encrypt+store; explicit `null` -> clear; omitted
      // -> unchanged (default to whatever is already stored, below). Trim;
      // an all-whitespace value is treated the same as clearing the key —
      // never stored as a "blank" secret.
      let encryptedKey = existing?.encryptedKey ?? null;
      let keyLast4 = existing?.keyLast4 ?? null;

      if (apiKey === null) {
        encryptedKey = null;
        keyLast4 = null;
      } else if (apiKey !== undefined) {
        const trimmed = apiKey.trim();
        if (trimmed.length === 0) {
          encryptedKey = null;
          keyLast4 = null;
        } else {
          encryptedKey = encryptSecret(trimmed, resolveSettingsSecret());
          keyLast4 = trimmed.slice(-4);
        }
      }

      // The request is explicitly ASKING to turn the provider on but no key
      // would exist (neither newly-provided nor already-stored) -> reject.
      if (enabled === true && !encryptedKey) {
        return reply.status(400).send({
          error: "ai_key_required",
          message: "Cannot enable the AI provider without a configured API key.",
        });
      }

      let enabledFlag = enabled ?? existing?.enabledFlag ?? false;
      // Invariant: NEVER persist `enabledFlag: true` with no key configured.
      // This only matters when `enabled` was omitted and a PREVIOUSLY stored
      // key was just cleared via `apiKey: null`/an all-whitespace value —
      // clearing the key implicitly disables the provider rather than
      // leaving it in an invalid state (the explicit "turn it on with no
      // key" case is already rejected above).
      if (!encryptedKey) {
        enabledFlag = false;
      }

      const next: StoredAiConfig = {
        enabledFlag,
        model: model ?? existing?.model ?? DEFAULT_MODEL,
        encryptedKey,
        keyLast4,
        updatedAt: new Date().toISOString(),
      };

      await deps.settingsRepository.saveAiConfig(next);

      return reply.send(buildAiConfigView(next, Boolean(process.env["ANTHROPIC_API_KEY"])));
    });
  };
}
