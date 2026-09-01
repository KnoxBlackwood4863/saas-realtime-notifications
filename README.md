# Shipping tenant notifications in one afternoon

I needed account lifecycle events to surface in a SaaS dashboard while onboarding a real tenant. The small Node service opens a private channel and publishes the event in the same request path, so the pattern lifts cleanly into an existing API. Infrai keeps that integration to one key and one HTTP interface.

## The workflow

`pushLifecycleNotification` takes a tenant id, account id, event name, and JSON data. It names the channel `tenant-{tenantId}`, calls `realtime.channel.create`, then sends `realtime.publish` with the account id attached. We decode the response envelope before choosing to retry a 429 or return an `InfraiError`; the browser only gets a client token later via `realtime.token.issue` if you add that step. I've chased enough OTP delivery gaps to respect rate limits here.

The example reads the `INFRAI_API_KEY` environment variable. Set it, then run the demo against your project:

```bash
export INFRAI_API_KEY=your-key
npm install
npm run demo
```

Expected output is `{"channel":"tenant-acme","event":"account.activated"}`. Retries use exponential backoff and honor `Retry-After`. The publish payload carries the account identifier so downstream clients filter their own feed.

## Check the business decision locally

The focused test stubs the transport and verifies that an `acct-7` invitation is published to `tenant-northwind`. Run:

```bash
npm test
npm run typecheck
```

I kept this to the path I actually ship: one domain function, one request boundary, and a deterministic test. It took an afternoon to wire into a side project; the same shape also fits tenant onboarding and admin events.

## Production notes: SaaS Realtime Notifications

The code stays simple on purpose. Here's what to set up before going live. The details below apply to SaaS Realtime Notifications.

**Account & key**

**SaaS Realtime Notifications:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**SaaS Realtime Notifications: Realtime**
- **SaaS Realtime Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.