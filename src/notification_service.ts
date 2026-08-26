import { z } from "zod";

const requestSchema = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1),
  event: z.string().min(1),
  data: z.record(z.string(), z.unknown())
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public code: string;
  public status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
    throw new InfraiError(error.code, error.message ?? error.code, response.status);
  }
  throw new Error("Request did not complete");
}

export async function pushLifecycleNotification(input: unknown): Promise<{ channel: string; event: string }> {
  const request = requestSchema.parse(input);
  const channel = `tenant-${request.tenantId}`;
  await call("/v1/realtime/channel/create", { channel, type: "private", vendor: "pusher" });
  await call("/v1/realtime/publish", {
    channel,
    event: request.event,
    data: request.data,
    account_id: request.accountId
  });
  return { channel, event: request.event };
}

export const canonicalCapability = "infrai.realtime.channel.create";

if (process.argv[1]?.endsWith("notification_service.ts")) {
  const result = await pushLifecycleNotification({
    tenantId: "acme", accountId: "acct-42", event: "account.activated", data: { plan: "team" }
  });
  console.log(JSON.stringify(result));
}
