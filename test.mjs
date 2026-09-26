// test.mjs
import { createClient } from '@massicloud/client'

// Patch global fetch BEFORE createClient
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, opts = {}) => {
  console.log('\n>>> Request:')
  console.log('   URL:', url.toString())
  console.log('   Method:', opts.method || 'GET')
  console.log('   Headers:', opts.headers)
  console.log('   Body:', opts.body)
  const res = await originalFetch(url, opts)
  console.log('<<< Response:', res.status)
  const clone = res.clone()
  const text = await clone.text()
  console.log('   Body:', text.slice(0, 500))
  return res
}

const massi = createClient({
  url:   'https://api.massicloud.work/v1/dar-el-djazair-e4dbea5b',
  key:   'mc_anon_LBpb6xklODfgdY82taMq4ovNCckpsFLuFF1ofk6EhDU',
  stage: 'production',
  db:    'main',
})

console.log('=== Test SELECT ===')
await massi.from('public_test').select()

console.log('\n=== Test INSERT ===')
await massi.from('public_test').insert({ message: 'hello' })
