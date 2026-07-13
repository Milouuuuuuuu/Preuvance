import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ASSESSMENT_QUOTA_LIMIT,
  ASSESSMENT_QUOTA_WINDOW_SECONDS,
  AssessmentQuotaUnavailableError,
  consumeAssessmentQuota,
} from "../lib/supabase/assessment-quota";
import type { Database } from "../lib/supabase/database.types";

test("le quota autorise une évaluation et normalise la décision RPC", async () => {
  const client = quotaClient({
    data: [
      {
        allowed: true,
        remaining: 4,
        retry_after_seconds: 0,
        request_limit: ASSESSMENT_QUOTA_LIMIT,
        window_seconds: ASSESSMENT_QUOTA_WINDOW_SECONDS,
      },
    ],
    error: null,
  });

  assert.deepEqual(await consumeAssessmentQuota(client), {
    allowed: true,
    remaining: 4,
    retryAfterSeconds: 0,
    limit: 5,
    windowSeconds: 3600,
  });
});

test("le quota refusé fournit toujours un Retry-After positif", async () => {
  const client = quotaClient({
    data: [
      {
        allowed: false,
        remaining: 0,
        retry_after_seconds: 0,
        request_limit: ASSESSMENT_QUOTA_LIMIT,
        window_seconds: ASSESSMENT_QUOTA_WINDOW_SECONDS,
      },
    ],
    error: null,
  });

  const decision = await consumeAssessmentQuota(client);
  assert.equal(decision.allowed, false);
  assert.equal(decision.retryAfterSeconds, 1);
});

test("une panne ou une réponse RPC incohérente échoue en mode fermé", async () => {
  await assert.rejects(
    consumeAssessmentQuota(
      quotaClient({ data: null, error: { message: "database unavailable" } }),
    ),
    AssessmentQuotaUnavailableError,
  );

  await assert.rejects(
    consumeAssessmentQuota(quotaClient({ data: [], error: null })),
    AssessmentQuotaUnavailableError,
  );

  await assert.rejects(
    consumeAssessmentQuota(
      quotaClient({
        data: [
          {
            allowed: true,
            remaining: 99,
            retry_after_seconds: 0,
            request_limit: 5,
            window_seconds: 3600,
          },
        ],
        error: null,
      }),
    ),
    AssessmentQuotaUnavailableError,
  );
});

test("la migration sérialise par utilisateur et interdit le reset client", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202607130003_assessment_rate_limit.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /security definer/i);
  assert.match(migration, /where limits\.user_id = current_user_id\s+for update/i);
  assert.match(
    migration,
    /revoke all on table public\.assessment_rate_limits from authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.consume_assessment_quota\(\) to authenticated/i,
  );
});

test("la route refuse avec 429 avant de démarrer OpenAI", () => {
  const route = readFileSync(
    new URL("../app/api/assessments/route.ts", import.meta.url),
    "utf8",
  );
  const quotaCall = route.indexOf("await consumeAssessmentQuota(supabase)");
  const pipelineCall = route.indexOf("await runAssessmentPipeline(input");

  assert.ok(quotaCall >= 0);
  assert.ok(pipelineCall > quotaCall);
  assert.match(route, /429,[\s\S]*ASSESSMENT_RATE_LIMIT_EXCEEDED/);
  assert.match(route, /"Retry-After": String\(quota\.retryAfterSeconds\)/);
});

type QuotaRpcResult = {
  data: unknown;
  error: { message: string } | null;
};

function quotaClient(result: QuotaRpcResult): SupabaseClient<Database> {
  return {
    async rpc(functionName: string) {
      assert.equal(functionName, "consume_assessment_quota");
      return result;
    },
  } as unknown as SupabaseClient<Database>;
}
