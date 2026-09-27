import path from "node:path"
import { config } from "dotenv"
import { createClient, type MassiCloudClient } from "@massicloud/client"

config({ path: path.resolve(process.cwd(), ".env.test") })

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set in .env.test`)
    return value
}

let counter = 0

/**
 * Signs up a fresh end-user in the tenant, signs them in, and returns a
 * client with an active session. Each call creates a distinct user, so
 * tests never share auth state.
 *
 * The SDK's AuthClient stores the session in memory after signUp/signIn,
 * so subsequent calls on the returned client (like storage.upload) will
 * automatically include the Bearer token via getAccessToken().
 */
export async function signUpAsEndUser(): Promise<MassiCloudClient> {
    const massi = createClient({
        url:   requireEnv("MASSICLOUD_URL"),
        key:   requireEnv("MASSICLOUD_ANON_KEY"),
        stage: requireEnv("MASSICLOUD_STAGE"),
        db:    requireEnv("MASSICLOUD_DB"),
    })

    counter++
    const email = `enduser-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}@test.dz`
    const password = "TestPassword123!"

    const { error } = await massi.auth.signUp({ email, password })
    if (error) {
        throw new Error(`signUp failed for ${email}: ${error.message}`)
    }

    return massi
}
