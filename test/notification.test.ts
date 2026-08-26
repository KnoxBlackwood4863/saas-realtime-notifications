import assert from "node:assert/strict";
import { pushLifecycleNotification } from "../src/notification_service.js";

const requests: Array<{ url: string; body: any }> = [];
globalThis.fetch = (async (input, init) => {
  requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
  return new Response(JSON.stringify({ ok: true, data: { accepted: true } }), { status: 200 });
}) as typeof fetch;
process.env.INFRAI_API_KEY = "test-key";

const result = await pushLifecycleNotification({ tenantId: "northwind", accountId: "acct-7", event: "user.invited", data: { role: "admin" } });
assert.deepEqual(result, { channel: "tenant-northwind", event: "user.invited" });
assert.equal(requests[1].body.account_id, "acct-7");
console.log("notification decision test passed");
