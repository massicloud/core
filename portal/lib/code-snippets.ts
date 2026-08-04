import type { Column } from '@/types/db'

export interface SnippetContext {
  projectSlug:    string
  stage:          string        // required — e.g. 'production'
  dbName:         string
  anonKeyDisplay: string        // prefix only — never the full key
  tableName?:     string
  primaryKey?:    string
  columns?:       Column[]
  apiBaseURL?:    string        // defaults to env var or localhost
}

export interface Snippets {
  curl: string
  js:   string
  py:   string
  go:   string
  sdk:  string
}

function buildBase(ctx: SnippetContext): string {
  const root = ctx.apiBaseURL
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? 'http://localhost:8080'
  return `${root}/v1/${ctx.projectSlug}/${ctx.stage}/db/${ctx.dbName}`
}

function buildSDKUrl(ctx: SnippetContext): string {
  const root = ctx.apiBaseURL
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? 'http://localhost:8080'
  return `${root}/v1/${ctx.projectSlug}`
}

export function buildAuthSnippets(ctx: SnippetContext) {
  const base = buildBase(ctx)
  const anon = `${ctx.anonKeyDisplay}…`

  return {
    curl: `# Sign up an end-user
curl -X POST ${base}/auth/signup \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.dz",
    "password": "secret123"
  }'

# Sign in
curl -X POST ${base}/auth/login \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.dz",
    "password": "secret123"
  }'

# Get the current user with the access_token from login
curl ${base}/auth/user \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`,

    js: `const PROJECT_URL = '${base}'
const ANON_KEY    = '${anon}'  // replace with your saved key

// Sign up
const signup = await fetch(\`\${PROJECT_URL}/auth/signup\`, {
  method: 'POST',
  headers: {
    'X-MassiCloud-Key': ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.dz',
    password: 'secret123',
  }),
})

const { access_token, refresh_token, user } = await signup.json()

// Sign in
const login = await fetch(\`\${PROJECT_URL}/auth/login\`, {
  method: 'POST',
  headers: {
    'X-MassiCloud-Key': ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.dz',
    password: 'secret123',
  }),
})`,

    py: `import requests

PROJECT_URL = "${base}"
ANON_KEY    = "${anon}"   # replace with your saved key

# Sign up
r = requests.post(
    f"{PROJECT_URL}/auth/signup",
    headers={"X-MassiCloud-Key": ANON_KEY},
    json={"email": "user@example.dz", "password": "secret123"},
)
data = r.json()
access_token = data["access_token"]

# Sign in
r = requests.post(
    f"{PROJECT_URL}/auth/login",
    headers={"X-MassiCloud-Key": ANON_KEY},
    json={"email": "user@example.dz", "password": "secret123"},
)`,

    go: `package main

import (
	"bytes"
	"encoding/json"
	"net/http"
)

const projectURL = "${base}"
const anonKey = "${anon}" // replace with your saved key

func main() {
	body, _ := json.Marshal(map[string]string{
		"email":    "user@example.dz",
		"password": "secret123",
	})

	// Sign up
	req, _ := http.NewRequest("POST", projectURL+"/auth/signup", bytes.NewReader(body))
	req.Header.Set("X-MassiCloud-Key", anonKey)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	var signup struct {
		AccessToken  string \`json:"access_token"\`
		RefreshToken string \`json:"refresh_token"\`
	}
	json.NewDecoder(resp.Body).Decode(&signup)

	// Sign in
	req, _ = http.NewRequest("POST", projectURL+"/auth/login", bytes.NewReader(body))
	req.Header.Set("X-MassiCloud-Key", anonKey)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	defer resp.Body.Close()
}`,
  }
}

export function buildRESTSnippets(ctx: SnippetContext): Snippets {
  if (!ctx.tableName) {
    throw new Error('tableName required for REST snippets')
  }

  const base    = buildBase(ctx)
  const sdkUrl  = buildSDKUrl(ctx)
  const restURL = `${base}/rest/${ctx.tableName}`
  const anon    = `${ctx.anonKeyDisplay}…`
  const pk      = ctx.primaryKey ?? 'id'

  const insertBody = ctx.columns
    ? buildInsertBody(ctx.columns)
    : { name: 'example' }
  const insertJSON = JSON.stringify(insertBody, null, 2)

  return {
    curl: `# List rows
curl "${restURL}" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter (PostgREST syntax)
curl "${restURL}?${pk}=eq.UUID_HERE" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Insert
curl -X POST "${restURL}" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '${insertJSON}'

# Update
curl -X PATCH "${restURL}?${pk}=eq.UUID_HERE" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"updated"}'

# Delete
curl -X DELETE "${restURL}?${pk}=eq.UUID_HERE" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`,

    js: `const REST_URL   = '${restURL}'
const ANON_KEY   = '${anon}'   // replace with your saved key
const USER_TOKEN = '...'       // from signin

const auth = {
  'X-MassiCloud-Key': ANON_KEY,
  'Authorization':    \`Bearer \${USER_TOKEN}\`,
}

// List
const rows = await fetch(REST_URL, { headers: auth }).then(r => r.json())

// Filter
const single = await fetch(
  \`\${REST_URL}?${pk}=eq.\${id}\`,
  { headers: auth }
).then(r => r.json())

// Insert
const created = await fetch(REST_URL, {
  method:  'POST',
  headers: { ...auth, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
  body:    JSON.stringify(${insertJSON}),
}).then(r => r.json())

// Update
await fetch(\`\${REST_URL}?${pk}=eq.\${id}\`, {
  method:  'PATCH',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body:    JSON.stringify({ name: 'updated' }),
})

// Delete
await fetch(\`\${REST_URL}?${pk}=eq.\${id}\`, {
  method:  'DELETE',
  headers: auth,
})`,

    py: `import requests

REST_URL   = "${restURL}"
ANON_KEY   = "${anon}"   # replace with your saved key
USER_TOKEN = "..."       # from signin

headers = {
    "X-MassiCloud-Key": ANON_KEY,
    "Authorization":    f"Bearer {USER_TOKEN}",
}

# List
rows = requests.get(REST_URL, headers=headers).json()

# Filter
single = requests.get(f"{REST_URL}?${pk}=eq.{id}", headers=headers).json()

# Insert
created = requests.post(
    REST_URL,
    headers={**headers, "Content-Type": "application/json", "Prefer": "return=representation"},
    json=${pythonDict(insertBody)},
).json()

# Update
requests.patch(
    f"{REST_URL}?${pk}=eq.{id}",
    headers={**headers, "Content-Type": "application/json"},
    json={"name": "updated"},
)

# Delete
requests.delete(f"{REST_URL}?${pk}=eq.{id}", headers=headers)`,

    go: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

const restURL = "${restURL}"
const anonKey = "${anon}" // replace with your saved key
const userToken = "..."   // from signin

func authHeaders(req *http.Request) {
	req.Header.Set("X-MassiCloud-Key", anonKey)
	req.Header.Set("Authorization", "Bearer "+userToken)
}

func main() {
	// List
	req, _ := http.NewRequest("GET", restURL, nil)
	authHeaders(req)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	// Filter
	req, _ = http.NewRequest("GET", fmt.Sprintf("%s?${pk}=eq.%s", restURL, id), nil)
	authHeaders(req)
	resp, _ = http.DefaultClient.Do(req)
	defer resp.Body.Close()

	// Insert
	body, _ := json.Marshal(${goMapLiteral(insertBody)})
	req, _ = http.NewRequest("POST", restURL, bytes.NewReader(body))
	authHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")
	resp, _ = http.DefaultClient.Do(req)
	defer resp.Body.Close()

	// Update
	updateBody, _ := json.Marshal(map[string]interface{}{"name": "updated"})
	req, _ = http.NewRequest("PATCH", fmt.Sprintf("%s?${pk}=eq.%s", restURL, id), bytes.NewReader(updateBody))
	authHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	defer resp.Body.Close()

	// Delete
	req, _ = http.NewRequest("DELETE", fmt.Sprintf("%s?${pk}=eq.%s", restURL, id), nil)
	authHeaders(req)
	resp, _ = http.DefaultClient.Do(req)
	defer resp.Body.Close()
}`,

    sdk: `import { createClient } from '@massicloud/client'

const massi = createClient({
  url:   '${sdkUrl}',
  key:   '${anon}',
  stage: '${ctx.stage}',
  db:    '${ctx.dbName}',
})

// List
const { data: rows, error } = await massi.from('${ctx.tableName}').select('*')

// Filter
const { data: row } = await massi
  .from('${ctx.tableName}')
  .select('*')
  .eq('${pk}', YOUR_ID)
  .single()

// Insert
const { data: created } = await massi
  .from('${ctx.tableName}')
  .insert(${insertJSON})
  .single()

// Update
await massi
  .from('${ctx.tableName}')
  .update({ name: 'updated' })
  .eq('${pk}', YOUR_ID)

// Delete
await massi
  .from('${ctx.tableName}')
  .delete()
  .eq('${pk}', YOUR_ID)`,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInsertBody(columns: Column[]): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const col of columns) {
    if (col.is_primary_key) continue
    if (col.default?.includes('nextval')) continue
    if (col.default?.includes('gen_random_uuid')) continue
    if (col.default?.includes('now()')) continue
    if (col.name === 'created_at' || col.name === 'updated_at') continue
    body[col.name] = exampleValueFor(col.type)
  }
  if (Object.keys(body).length === 0) body.name = 'example'
  return body
}

function exampleValueFor(type: string): unknown {
  const t = type.toLowerCase()
  if (t.includes('int') || t.includes('numeric') || t.includes('decimal')) return 0
  if (t.includes('bool')) return false
  if (t.includes('json')) return {}
  if (t.includes('uuid')) return '00000000-0000-0000-0000-000000000000'
  if (t.includes('timestamp') || t.includes('date')) return '2024-01-01T00:00:00.000Z'
  if (t.includes('text') || t === 'varchar' || t.includes('char')) return 'example'
  return 'example'
}

export function buildOperationSnippets(
  ctx: SnippetContext,
  op: 'read' | 'read_one' | 'insert' | 'update' | 'delete',
): Snippets {
  if (!ctx.tableName) throw new Error('tableName required')

  const base    = buildBase(ctx)
  const sdkUrl  = buildSDKUrl(ctx)
  const restURL = `${base}/rest/${ctx.tableName}`
  const anon    = `${ctx.anonKeyDisplay}…`
  const pk      = ctx.primaryKey ?? 'id'
  const insertBody = ctx.columns ? buildInsertBody(ctx.columns) : { name: 'example' }
  const insertJSON = JSON.stringify(insertBody, null, 2)

  const auth = {
    curl: `-H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_USER_TOKEN"`,
    js: `headers: {
    'X-MassiCloud-Key': '${anon}',
    'Authorization':    'Bearer ' + USER_TOKEN,
  }`,
    py: `headers = {
    "X-MassiCloud-Key": "${anon}",
    "Authorization":    f"Bearer {USER_TOKEN}",
}`,
    go: `req.Header.Set("X-MassiCloud-Key", "${anon}")
req.Header.Set("Authorization", "Bearer "+userToken)`,
  }

  const sdkHeader = `import { createClient } from '@massicloud/client'

const massi = createClient({
  url:   '${sdkUrl}',
  key:   '${anon}',
  stage: '${ctx.stage}',
  db:    '${ctx.dbName}',
})`

  const goHeader = `import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

const restURL = "${restURL}"
const userToken = "..." // from signin`

  switch (op) {
    case 'read':
      return {
        curl: `curl "${restURL}" \\
  ${auth.curl}`,
        js: `const rows = await fetch('${restURL}', {
  ${auth.js},
}).then(r => r.json())`,
        py: `${auth.py}

rows = requests.get("${restURL}", headers=headers).json()`,
        go: `${goHeader}

req, _ := http.NewRequest("GET", restURL, nil)
${auth.go}
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
        sdk: `${sdkHeader}

const { data, error } = await massi
  .from('${ctx.tableName}')
  .select('*')`,
      }

    case 'read_one':
      return {
        curl: `curl "${restURL}?${pk}=eq.YOUR_ID" \\
  ${auth.curl}`,
        js: `const row = await fetch(\`${restURL}?${pk}=eq.\${id}\`, {
  ${auth.js},
}).then(r => r.json())`,
        py: `${auth.py}

row = requests.get(f"${restURL}?${pk}=eq.{id}", headers=headers).json()`,
        go: `${goHeader}

req, _ := http.NewRequest("GET", fmt.Sprintf("%s?${pk}=eq.%s", restURL, id), nil)
${auth.go}
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
        sdk: `${sdkHeader}

const { data, error } = await massi
  .from('${ctx.tableName}')
  .select('*')
  .eq('${pk}', YOUR_ID)
  .single()`,
      }

    case 'insert':
      return {
        curl: `curl -X POST "${restURL}" \\
  ${auth.curl} \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '${insertJSON}'`,
        js: `const created = await fetch('${restURL}', {
  method:  'POST',
  ${auth.js},
  body: JSON.stringify(${insertJSON}),
}).then(r => r.json())`,
        py: `${auth.py}

created = requests.post(
    "${restURL}",
    headers={**headers, "Content-Type": "application/json", "Prefer": "return=representation"},
    json=${pythonDict(insertBody)},
).json()`,
        go: `${goHeader}

body, _ := json.Marshal(${goMapLiteral(insertBody)})
req, _ := http.NewRequest("POST", restURL, bytes.NewReader(body))
${auth.go}
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Prefer", "return=representation")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
        sdk: `${sdkHeader}

const { data, error } = await massi
  .from('${ctx.tableName}')
  .insert(${insertJSON})
  .single()`,
      }

    case 'update':
      return {
        curl: `curl -X PATCH "${restURL}?${pk}=eq.YOUR_ID" \\
  ${auth.curl} \\
  -H "Content-Type: application/json" \\
  -d '{"name":"updated"}'`,
        js: `await fetch(\`${restURL}?${pk}=eq.\${id}\`, {
  method:  'PATCH',
  ${auth.js},
  body: JSON.stringify({ name: 'updated' }),
})`,
        py: `${auth.py}

requests.patch(
    f"${restURL}?${pk}=eq.{id}",
    headers={**headers, "Content-Type": "application/json"},
    json={"name": "updated"},
)`,
        go: `${goHeader}

body, _ := json.Marshal(map[string]interface{}{"name": "updated"})
req, _ := http.NewRequest("PATCH", fmt.Sprintf("%s?${pk}=eq.%s", restURL, id), bytes.NewReader(body))
${auth.go}
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
        sdk: `${sdkHeader}

const { error } = await massi
  .from('${ctx.tableName}')
  .update({ name: 'updated' })
  .eq('${pk}', YOUR_ID)`,
      }

    case 'delete':
      return {
        curl: `curl -X DELETE "${restURL}?${pk}=eq.YOUR_ID" \\
  ${auth.curl}`,
        js: `await fetch(\`${restURL}?${pk}=eq.\${id}\`, {
  method: 'DELETE',
  ${auth.js},
})`,
        py: `${auth.py}

requests.delete(f"${restURL}?${pk}=eq.{id}", headers=headers)`,
        go: `${goHeader}

req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s?${pk}=eq.%s", restURL, id), nil)
${auth.go}
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
        sdk: `${sdkHeader}

const { error } = await massi
  .from('${ctx.tableName}')
  .delete()
  .eq('${pk}', YOUR_ID)`,
      }
  }
}

export function buildAuthOperationSnippets(
  ctx: Pick<SnippetContext, 'projectSlug' | 'stage' | 'dbName' | 'anonKeyDisplay' | 'apiBaseURL'>,
  op: 'signup' | 'login' | 'refresh' | 'user',
): Snippets {
  const root    = ctx.apiBaseURL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
  const base    = `${root}/v1/${ctx.projectSlug}/${ctx.stage}/db/${ctx.dbName}`
  const sdkUrl  = `${root}/v1/${ctx.projectSlug}`
  const anon    = `${ctx.anonKeyDisplay}…`

  const sdkSetup = `import { createClient } from '@massicloud/client'

const massi = createClient({
  url:   '${sdkUrl}',
  key:   '${anon}',
  stage: '${ctx.stage}',
  db:    '${ctx.dbName}',
})`

  const goImports = (extra: string[] = ['bytes', 'encoding/json']) => `import (
${[...extra, 'net/http'].sort().map((i) => `\t"${i}"`).join('\n')}
)

const baseURL = "${base}"
const anonKey = "${anon}" // replace with your saved key`

  switch (op) {
    case 'signup': return {
      curl: `curl -X POST ${base}/auth/signup \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.dz","password":"secret123"}'`,
      js: `const res = await fetch('${base}/auth/signup', {
  method: 'POST',
  headers: {
    'X-MassiCloud-Key': '${anon}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.dz',
    password: 'secret123',
  }),
})
const { access_token, refresh_token, user } = await res.json()`,
      py: `import requests

r = requests.post(
    "${base}/auth/signup",
    headers={"X-MassiCloud-Key": "${anon}"},
    json={"email": "user@example.dz", "password": "secret123"},
)
data = r.json()`,
      go: `${goImports()}

body, _ := json.Marshal(map[string]string{
	"email":    "user@example.dz",
	"password": "secret123",
})
req, _ := http.NewRequest("POST", baseURL+"/auth/signup", bytes.NewReader(body))
req.Header.Set("X-MassiCloud-Key", anonKey)
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

var signup struct {
	AccessToken  string \`json:"access_token"\`
	RefreshToken string \`json:"refresh_token"\`
}
json.NewDecoder(resp.Body).Decode(&signup)`,
      sdk: `${sdkSetup}

const { data, error } = await massi.auth.signUp({
  email:    'user@example.dz',
  password: 'secret123',
})`,
    }

    case 'login': return {
      curl: `curl -X POST ${base}/auth/login \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.dz","password":"secret123"}'`,
      js: `const res = await fetch('${base}/auth/login', {
  method: 'POST',
  headers: {
    'X-MassiCloud-Key': '${anon}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.dz',
    password: 'secret123',
  }),
})
const { access_token } = await res.json()`,
      py: `r = requests.post(
    "${base}/auth/login",
    headers={"X-MassiCloud-Key": "${anon}"},
    json={"email": "user@example.dz", "password": "secret123"},
)`,
      go: `${goImports()}

body, _ := json.Marshal(map[string]string{
	"email":    "user@example.dz",
	"password": "secret123",
})
req, _ := http.NewRequest("POST", baseURL+"/auth/login", bytes.NewReader(body))
req.Header.Set("X-MassiCloud-Key", anonKey)
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

var login struct {
	AccessToken string \`json:"access_token"\`
}
json.NewDecoder(resp.Body).Decode(&login)`,
      sdk: `const { data, error } = await massi.auth.signIn({
  email:    'user@example.dz',
  password: 'secret123',
})`,
    }

    case 'refresh': return {
      curl: `curl -X POST ${base}/auth/refresh \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Content-Type: application/json" \\
  -d '{"refresh_token":"YOUR_REFRESH_TOKEN"}'`,
      js: `const res = await fetch('${base}/auth/refresh', {
  method: 'POST',
  headers: {
    'X-MassiCloud-Key': '${anon}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ refresh_token: refreshToken }),
})
const { access_token } = await res.json()`,
      py: `r = requests.post(
    "${base}/auth/refresh",
    headers={"X-MassiCloud-Key": "${anon}"},
    json={"refresh_token": refresh_token},
)`,
      go: `${goImports()}

body, _ := json.Marshal(map[string]string{"refresh_token": refreshToken})
req, _ := http.NewRequest("POST", baseURL+"/auth/refresh", bytes.NewReader(body))
req.Header.Set("X-MassiCloud-Key", anonKey)
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
      sdk: `// The SDK refreshes tokens automatically.
// To read the current token:
const token = await massi.auth.getAccessToken()`,
    }

    case 'user': return {
      curl: `curl ${base}/auth/user \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`,
      js: `const res = await fetch('${base}/auth/user', {
  headers: {
    'X-MassiCloud-Key': '${anon}',
    'Authorization': \`Bearer \${accessToken}\`,
  },
})
const user = await res.json()`,
      py: `r = requests.get(
    "${base}/auth/user",
    headers={
        "X-MassiCloud-Key": "${anon}",
        "Authorization": f"Bearer {access_token}",
    },
)
user = r.json()`,
      go: `${goImports([])}

req, _ := http.NewRequest("GET", baseURL+"/auth/user", nil)
req.Header.Set("X-MassiCloud-Key", anonKey)
req.Header.Set("Authorization", "Bearer "+accessToken)
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
      sdk: `const { data: user, error } = await massi.auth.getUser()`,
    }
  }
}

function pythonDict(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).map(([k, v]) => {
    const val =
      v === null ? 'None'
      : v === true ? 'True'
      : v === false ? 'False'
      : JSON.stringify(v)
    return `        "${k}": ${val}`
  })
  return `{\n${entries.join(',\n')}\n    }`
}

function goMapLiteral(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).map(([k, v]) => `\t"${k}": ${JSON.stringify(v)}`)
  return `map[string]interface{}{\n${entries.join(',\n')},\n}`
}

// ─── Object storage ───────────────────────────────────────────────────────────

export interface StorageSnippetContext {
  projectSlug:    string
  anonKeyDisplay: string  // prefix only — never the full key
  bucketName:     string
  apiBaseURL?:    string
}

/**
 * Snippets for the end-user-facing, mediated storage routes
 * (/v1/{slug}/storage/buckets/{name}/...). These never carry MinIO
 * credentials — reads on public buckets need only the anon key, writes
 * always need a signed-in end user, and downloads can also go through a
 * credential-free, time-limited signed URL.
 */
export function buildStorageSnippets(
  ctx: StorageSnippetContext,
  op: 'list' | 'upload' | 'download' | 'signedUrl' | 'remove',
): Snippets {
  const root = ctx.apiBaseURL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
  const sdkUrl = `${root}/v1/${ctx.projectSlug}`
  const bucketURL = `${sdkUrl}/storage/buckets/${ctx.bucketName}`
  const anon = `${ctx.anonKeyDisplay}…`

  const sdkSetup = `import { createClient } from '@massicloud/client'

const massi = createClient({
  url:   '${sdkUrl}',
  key:   '${anon}',
  stage: 'production',
})`

  const goImports = (extra: string[] = []) => `import (
	"net/http"${extra.map((i) => `\n\t"${i}"`).join('')}
)

const bucketURL = "${bucketURL}"
const anonKey = "${anon}" // replace with your saved key`

  switch (op) {
    case 'list':
      return {
        curl: `curl "${bucketURL}/objects?prefix=users/" \\
  -H "X-MassiCloud-Key: ${anon}"`,
        js: `const res = await fetch('${bucketURL}/objects?prefix=users/', {
  headers: { 'X-MassiCloud-Key': '${anon}' },
})
const { objects, folders } = await res.json()`,
        py: `import requests

r = requests.get(
    "${bucketURL}/objects",
    headers={"X-MassiCloud-Key": "${anon}"},
    params={"prefix": "users/"},
)
data = r.json()`,
        go: `${goImports()}

req, _ := http.NewRequest("GET", bucketURL+"/objects?prefix=users/", nil)
req.Header.Set("X-MassiCloud-Key", anonKey)
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
        sdk: `${sdkSetup}

const { data: list, error } = await massi.storage
  .from('${ctx.bucketName}')
  .list('users/')`,
      }

    case 'upload':
      return {
        curl: `curl -X POST "${bucketURL}/objects" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_USER_TOKEN" \\
  -F "key=users/42/photo.txt" \\
  -F "file=@photo.txt"`,
        js: `const form = new FormData()
form.append('key', 'users/42/photo.txt')
form.append('file', fileInput.files[0])

await fetch('${bucketURL}/objects', {
  method: 'POST',
  headers: {
    'X-MassiCloud-Key': '${anon}',
    'Authorization': \`Bearer \${userToken}\`,
  },
  body: form,
})`,
        py: `import requests

with open("photo.txt", "rb") as f:
    r = requests.post(
        "${bucketURL}/objects",
        headers={
            "X-MassiCloud-Key": "${anon}",
            "Authorization": f"Bearer {user_token}",
        },
        data={"key": "users/42/photo.txt"},
        files={"file": f},
    )`,
        go: `${goImports(['bytes', 'io', 'mime/multipart', 'os'])}

func upload() error {
	file, _ := os.Open("photo.txt")
	defer file.Close()

	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	w.WriteField("key", "users/42/photo.txt")
	part, _ := w.CreateFormFile("file", "photo.txt")
	io.Copy(part, file)
	w.Close()

	req, _ := http.NewRequest("POST", bucketURL+"/objects", body)
	req.Header.Set("X-MassiCloud-Key", anonKey)
	req.Header.Set("Authorization", "Bearer "+userToken)
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}`,
        sdk: `${sdkSetup}

const file = fileInput.files[0] // a Blob/File
const { data, error } = await massi.storage
  .from('${ctx.bucketName}')
  .upload('users/42/photo.txt', file)`,
      }

    case 'download':
      return {
        curl: `curl "${bucketURL}/objects/users/42/photo.txt" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -o photo.txt`,
        js: `const res = await fetch('${bucketURL}/objects/users/42/photo.txt', {
  headers: { 'X-MassiCloud-Key': '${anon}' },
})
const blob = await res.blob()`,
        py: `import requests

r = requests.get(
    "${bucketURL}/objects/users/42/photo.txt",
    headers={"X-MassiCloud-Key": "${anon}"},
)
with open("photo.txt", "wb") as f:
    f.write(r.content)`,
        go: `${goImports(['io', 'os'])}

req, _ := http.NewRequest("GET", bucketURL+"/objects/users/42/photo.txt", nil)
req.Header.Set("X-MassiCloud-Key", anonKey)
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()

out, _ := os.Create("photo.txt")
defer out.Close()
io.Copy(out, resp.Body)`,
        sdk: `${sdkSetup}

const { data: blob, error } = await massi.storage
  .from('${ctx.bucketName}')
  .download('users/42/photo.txt')`,
      }

    case 'signedUrl':
      return {
        curl: `curl -X POST "${bucketURL}/presign" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"users/42/photo.txt","expires_in_seconds":3600}'`,
        js: `const res = await fetch('${bucketURL}/presign', {
  method: 'POST',
  headers: {
    'X-MassiCloud-Key': '${anon}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ key: 'users/42/photo.txt', expires_in_seconds: 3600 }),
})
const { url, expires_at } = await res.json()
// url is credential-free and safe to share or hotlink`,
        py: `import requests

r = requests.post(
    "${bucketURL}/presign",
    headers={"X-MassiCloud-Key": "${anon}"},
    json={"key": "users/42/photo.txt", "expires_in_seconds": 3600},
)
signed = r.json()  # { "url": ..., "expires_at": ... }`,
        go: `${goImports(['bytes', 'encoding/json'])}

body, _ := json.Marshal(map[string]interface{}{
	"key":                "users/42/photo.txt",
	"expires_in_seconds": 3600,
})
req, _ := http.NewRequest("POST", bucketURL+"/presign", bytes.NewReader(body))
req.Header.Set("X-MassiCloud-Key", anonKey)
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
        sdk: `${sdkSetup}

const { data: signed, error } = await massi.storage
  .from('${ctx.bucketName}')
  .createSignedUrl('users/42/photo.txt', 3600)

console.log(signed?.url) // credential-free, safe to share or hotlink`,
      }

    case 'remove':
      return {
        curl: `curl -X DELETE "${bucketURL}/objects/users/42/photo.txt" \\
  -H "X-MassiCloud-Key: ${anon}" \\
  -H "Authorization: Bearer YOUR_USER_TOKEN"`,
        js: `await fetch('${bucketURL}/objects/users/42/photo.txt', {
  method: 'DELETE',
  headers: {
    'X-MassiCloud-Key': '${anon}',
    'Authorization': \`Bearer \${userToken}\`,
  },
})`,
        py: `import requests

requests.delete(
    "${bucketURL}/objects/users/42/photo.txt",
    headers={
        "X-MassiCloud-Key": "${anon}",
        "Authorization": f"Bearer {user_token}",
    },
)`,
        go: `${goImports()}

req, _ := http.NewRequest("DELETE", bucketURL+"/objects/users/42/photo.txt", nil)
req.Header.Set("X-MassiCloud-Key", anonKey)
req.Header.Set("Authorization", "Bearer "+userToken)
resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`,
        sdk: `${sdkSetup}

await massi.storage
  .from('${ctx.bucketName}')
  .remove('users/42/photo.txt')`,
      }
  }
}
