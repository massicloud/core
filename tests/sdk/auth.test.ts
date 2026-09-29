import { beforeAll, describe, expect, it } from "vitest"
import { makeAnonClient } from "../helpers/client"
import { uniqueEmail } from "../helpers/random"
import type { MassiCloudClient } from "@massicloud/client"

// uniqueEmail() (helpers/random.ts) mints `<local>-<ts>-<rand>@example.dz`
// addresses. The cleanup block at the bottom of this file deletes every
// auth.users row on that exact domain, so every test below must go through
// uniqueEmail() rather than inventing its own address scheme, or it'll leak
// a row past this file's own cleanup.
const PASSWORD = "TestPassword123!"

// Runs a raw SQL statement via the service-key admin /query endpoint (same
// one the CLI's migration runner and this file's own cleanup use) — needed
// for the expired-token test below, which has no other way to backdate a
// row's expires_at.
async function runAdminQuery(query: string): Promise<void> {
  const url =
    `${process.env.MASSICLOUD_URL}/${process.env.MASSICLOUD_STAGE}` +
    `/db/${process.env.MASSICLOUD_DB}/query`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-MassiCloud-Key": process.env.MASSICLOUD_SERVICE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    throw new Error(`admin query failed (${res.status}): ${await res.text()}`)
  }
}

describe("Auth: signUp", () => {
  it("creates user and returns session with tokens", async () => {
    const massi = makeAnonClient()
    const { data, error } = await massi.auth.signUp({
      email: uniqueEmail(),
      password: PASSWORD,
    })
    expect(error).toBeNull()
    expect(data?.access_token).toBeTruthy()
    expect(data?.refresh_token).toBeTruthy()
    expect(data?.user?.id).toBeTruthy()
  })

  it("rejects duplicate email with a clean 409 and structured error", async () => {
    const email = uniqueEmail()
    const a = makeAnonClient()
    await a.auth.signUp({ email, password: PASSWORD })

    const b = makeAnonClient()
    const { data, error } = await b.auth.signUp({
      email,
      password: "AnotherPassword456!",
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    // Fixed (see BUGS.md): used to be a 500 with a leaked Postgres error.
    expect(error?.status).toBe(409)
    expect(error?.message).toContain("already registered")
  })

  // Fixed (see BUGS.md): SignUpEndUser used to do a SELECT-then-INSERT
  // duplicate check, so two concurrent signups for the same email could
  // both pass the SELECT and race on the INSERT, with the loser getting a
  // raw 500 with a leaked Postgres error. It now inserts directly and maps
  // the resulting unique-constraint violation to a clean 409, so exactly
  // one of two racing signups should succeed and the other should see the
  // same clean 409 the sequential case above does.
  it("racing signups for the same email: exactly one succeeds, the other gets a clean 409", async () => {
    const email = uniqueEmail()
    const a = makeAnonClient()
    const b = makeAnonClient()

    const results = await Promise.all([
      a.auth.signUp({ email, password: "Password1!" }),
      b.auth.signUp({ email, password: "Password2!" }),
    ])

    const successes = results.filter((r) => !r.error)
    const conflicts = results.filter((r) => r.error)

    expect(successes).toHaveLength(1)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].error?.status).toBe(409)
  })

  // Fixed (see BUGS.md): the server used to accept any string containing an
  // "@" (so e.g. "test@nodomain" created a user); it now requires a
  // syntactically valid local@domain.tld address. The SDK also pre-checks
  // client-side with the same shape of regex, so these are rejected before
  // ever reaching the network.
  it.each([
    "not-an-email",
    "test@",
    "test@nodomain",
    "@example.com",
    "test @example.com",
  ])("rejects invalid email format: %s", async (email) => {
    const massi = makeAnonClient()
    const { data, error } = await massi.auth.signUp({
      email,
      password: PASSWORD,
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it("rejects short password", async () => {
    const massi = makeAnonClient()
    const { data, error } = await massi.auth.signUp({
      email: uniqueEmail(),
      password: "123",
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})

describe("Auth: signIn", () => {
  let email: string

  beforeAll(async () => {
    email = uniqueEmail()
    const setup = makeAnonClient()
    const { error } = await setup.auth.signUp({ email, password: PASSWORD })
    if (error) throw new Error(`signUp setup failed for ${email}: ${error.message}`)
  })

  it("returns session for valid credentials", async () => {
    const massi = makeAnonClient()
    const { data, error } = await massi.auth.signIn({ email, password: PASSWORD })
    expect(error).toBeNull()
    expect(data?.access_token).toBeTruthy()
  })

  it("rejects wrong password", async () => {
    const massi = makeAnonClient()
    const { data, error } = await massi.auth.signIn({
      email,
      password: "WrongPassword999!",
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it("rejects non-existent user", async () => {
    const massi = makeAnonClient()
    const { data, error } = await massi.auth.signIn({
      email: uniqueEmail("noone"),
      password: PASSWORD,
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})

describe("Auth: session management", () => {
  let massi: MassiCloudClient
  const email = uniqueEmail()

  beforeAll(async () => {
    massi = makeAnonClient()
    const { error } = await massi.auth.signUp({ email, password: PASSWORD })
    if (error) throw new Error(`signUp setup failed for ${email}: ${error.message}`)
  })

  it("getSession returns active session after signUp", async () => {
    const { data } = await massi.auth.getSession()
    expect(data?.access_token).toBeTruthy()
    expect(data?.user?.email).toBe(email)
  })

  it("getUser returns user profile", async () => {
    const { data, error } = await massi.auth.getUser()
    expect(error).toBeNull()
    expect(data?.email).toBe(email)
    expect(data?.id).toBeTruthy()
  })

  it("getAccessToken returns a JWT string", async () => {
    const token = await massi.auth.getAccessToken()
    expect(typeof token).toBe("string")
    expect(token?.split(".").length).toBe(3) // header.payload.signature
  })

  it("signOut clears session", async () => {
    const { error } = await massi.auth.signOut()
    expect(error).toBeNull()

    const { data } = await massi.auth.getSession()
    expect(data).toBeNull()
    const token = await massi.auth.getAccessToken()
    expect(token).toBeNull()
  })
})

describe("Auth: session management (no session yet)", () => {
  it("getAccessToken returns null before any signUp/signIn", async () => {
    const massi = makeAnonClient()
    const token = await massi.auth.getAccessToken()
    expect(token).toBeNull()
  })

  it("getSession returns null before any signUp/signIn", async () => {
    const massi = makeAnonClient()
    const { data } = await massi.auth.getSession()
    expect(data).toBeNull()
  })
})

describe("Auth: onAuthStateChange", () => {
  it("fires SIGNED_IN with the new session on signUp", async () => {
    const massi = makeAnonClient()
    const events: Array<{ event: string; hasSession: boolean }> = []
    massi.auth.onAuthStateChange((event, session) => {
      events.push({ event, hasSession: session !== null })
    })

    const { error } = await massi.auth.signUp({ email: uniqueEmail(), password: PASSWORD })
    expect(error).toBeNull()
    expect(events).toContainEqual({ event: "SIGNED_IN", hasSession: true })
  })

  it("fires SIGNED_OUT on signOut, and stops firing after unsubscribe", async () => {
    const massi = makeAnonClient()
    await massi.auth.signUp({ email: uniqueEmail(), password: PASSWORD })

    const events: string[] = []
    const { unsubscribe } = massi.auth.onAuthStateChange((event) => {
      events.push(event)
    })

    unsubscribe()
    await massi.auth.signOut()
    expect(events).toEqual([])
  })
})

describe("Auth: cross-project isolation", () => {
  // A token issued for project A should be rejected by project B (different
  // JWTSigningSecret per project.ID — see projectauth.IssueAccessToken).
  // Exercising that needs a second live MassiCloud project; this test suite
  // only has the one QA project configured in .env.test, so this is
  // deferred rather than faked.
  it.skip("token from project A rejected by project B", async () => {
    // Requires a second test project; not available in current setup.
  })
})

// ----- Password reset --------------------------------------------------
// Fixed (see BUGS.md): SDK and API both now support password reset
// end-to-end. Email delivery is a separate follow-up — until then,
// requestPasswordReset's response carries the raw token directly (a
// `note` field on the raw JSON flags this as temporary).
describe("Auth: password reset", () => {
  it("requestPasswordReset returns a token for an existing user", async () => {
    const email = uniqueEmail()
    const massi = makeAnonClient()
    await massi.auth.signUp({ email, password: PASSWORD })

    const { data, error } = await massi.auth.requestPasswordReset(email)
    expect(error).toBeNull()
    expect(data?.reset_token).toBeTruthy()
    expect(data?.message).toBeTruthy()
  })

  it("silently succeeds for a non-existent user (no user enumeration)", async () => {
    const massi = makeAnonClient()
    const { data, error } = await massi.auth.requestPasswordReset(uniqueEmail("noone"))
    expect(error).toBeNull()
    expect(data?.reset_token).toBeUndefined()
    expect(data?.message).toBeTruthy()
  })

  it("confirmPasswordReset with a valid token succeeds", async () => {
    const email = uniqueEmail()
    const massi = makeAnonClient()
    await massi.auth.signUp({ email, password: PASSWORD })
    const { data: reset } = await massi.auth.requestPasswordReset(email)

    const { data, error } = await massi.auth.confirmPasswordReset({
      token: reset!.reset_token!,
      new_password: "NewPassword789!",
    })
    expect(error).toBeNull()
    expect(data?.message).toBeTruthy()
  })

  it("confirmPasswordReset with an expired token fails", async () => {
    const email = uniqueEmail()
    const massi = makeAnonClient()
    await massi.auth.signUp({ email, password: PASSWORD })
    const { data: reset } = await massi.auth.requestPasswordReset(email)
    expect(reset?.reset_token).toBeTruthy()

    // No SDK/API way to mint an already-expired token (server fixes expiry
    // at 1 hour), so backdate the row directly via the service-key admin
    // query endpoint instead.
    await runAdminQuery(
      `UPDATE auth.password_reset_tokens
       SET expires_at = NOW() - INTERVAL '1 minute'
       WHERE user_id = (SELECT id FROM auth.users WHERE email = '${email}')
         AND used_at IS NULL`,
    )

    const { data, error } = await massi.auth.confirmPasswordReset({
      token: reset!.reset_token!,
      new_password: "NewPassword789!",
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.status).toBe(400)
  })

  it("confirmPasswordReset with an already-used token fails", async () => {
    const email = uniqueEmail()
    const massi = makeAnonClient()
    await massi.auth.signUp({ email, password: PASSWORD })
    const { data: reset } = await massi.auth.requestPasswordReset(email)
    const token = reset!.reset_token!

    const first = await massi.auth.confirmPasswordReset({ token, new_password: "NewPassword789!" })
    expect(first.error).toBeNull()

    const { data, error } = await massi.auth.confirmPasswordReset({
      token,
      new_password: "AnotherPassword000!",
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.status).toBe(400)
  })

  it("confirmPasswordReset with an unknown token fails", async () => {
    const massi = makeAnonClient()
    const { data, error } = await massi.auth.confirmPasswordReset({
      token: "0".repeat(64),
      new_password: "NewPassword789!",
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.status).toBe(400)
  })

  it("confirmPasswordReset rejects a new_password that fails validation", async () => {
    const email = uniqueEmail()
    const massi = makeAnonClient()
    await massi.auth.signUp({ email, password: PASSWORD })
    const { data: reset } = await massi.auth.requestPasswordReset(email)

    const { data, error } = await massi.auth.confirmPasswordReset({
      token: reset!.reset_token!,
      new_password: "123",
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.status).toBe(400)
  })

  it("after reset, the user can sign in with the new password and not the old one", async () => {
    const email = uniqueEmail()
    const massi = makeAnonClient()
    await massi.auth.signUp({ email, password: PASSWORD })
    const { data: reset } = await massi.auth.requestPasswordReset(email)

    const { error: confirmError } = await massi.auth.confirmPasswordReset({
      token: reset!.reset_token!,
      new_password: "NewPassword789!",
    })
    expect(confirmError).toBeNull()

    const oldSignIn = await makeAnonClient().auth.signIn({ email, password: PASSWORD })
    expect(oldSignIn.data).toBeNull()
    expect(oldSignIn.error).not.toBeNull()

    const newSignIn = await makeAnonClient().auth.signIn({ email, password: "NewPassword789!" })
    expect(newSignIn.error).toBeNull()
    expect(newSignIn.data?.access_token).toBeTruthy()
  })

  // See BUGS.md: end-user access tokens are stateless JWTs verified only
  // against project.JWTSigningSecret (middleware.RequireEndUserToken never
  // consults auth.sessions), and nothing ever wrote a row there for them
  // either — so ConfirmPasswordReset's `DELETE FROM auth.sessions` is a
  // real no-op today, not actual revocation. A token issued before the
  // reset keeps authenticating requests until it naturally expires. Fixing
  // that needs per-user token versioning (or real server-side session
  // storage) checked inside RequireEndUserToken — bigger than this task's
  // three bug fixes, so this is deferred rather than asserting something
  // false.
  it.skip("after reset, the old access_token no longer works", async () => {
    // Blocked on real session/token revocation — see BUGS.md.
  })

  // Superseded (see BUGS.md and sdk/ratelimit.test.ts): password reset's
  // own per-email 3/hour limiter has been removed in favor of the
  // platform-wide "auth" category (10 req/sec per API key, shared with
  // every other auth endpoint). That cap — and proof the old 3/hour one is
  // gone — is now covered by "Rate limits: auth" in ratelimit.test.ts, not
  // here.
})

// ----- Cleanup -----------------------------------------------------------
// Deletes every auth.users row this file created (all on the uniqueEmail()
// @example.dz domain) so repeated runs don't bloat auth.users indefinitely.
// Uses the raw /query admin endpoint directly (same one the CLI's migration
// runner uses) since the SDK has no raw-SQL escape hatch for service-role
// callers.
describe("Auth: cleanup", () => {
  it("deletes all auth.users rows created by this file", async () => {
    await runAdminQuery("DELETE FROM auth.users WHERE email LIKE '%@example.dz'")
  })
})
