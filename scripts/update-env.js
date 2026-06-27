const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

try {
  console.log('Fetching local Supabase status...')
  const output = execSync('npx supabase status', { encoding: 'utf-8' })
  
  // Find JSON start
  const jsonStart = output.indexOf('{')
  if (jsonStart === -1) {
    throw new Error('No JSON output found in Supabase status.')
  }

  const jsonStr = output.substring(jsonStart)
  const data = JSON.parse(jsonStr)

  const hostApiUrl = data.API_URL
  const hostDbUrl = data.DB_URL
  const anonKey = data.ANON_KEY

  if (!hostApiUrl || !hostDbUrl || !anonKey) {
    throw new Error('Missing required fields in Supabase status.')
  }

  // NEXT_PUBLIC_SUPABASE_URL needs to point to localhost (127.0.0.1) for the browser
  const browserApiUrl = hostApiUrl.replace('127.0.0.1', 'localhost')

  // SUPABASE_URL needs to point to host.docker.internal for server-side container access
  const containerApiUrl = hostApiUrl.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal')
  const containerDbUrl = hostDbUrl.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal')

  // Write to .env
  const envContent = `
# Automatically updated by scripts/update-env.js
NEXT_PUBLIC_SUPABASE_URL=${browserApiUrl}
SUPABASE_URL=${containerApiUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
DATABASE_URL=${containerDbUrl}
`

  fs.writeFileSync(path.join(__dirname, '../.env'), envContent.trim() + '\n')
  console.log('=== .env updated successfully with local Supabase configuration ===')
  console.log(`Browser API URL: ${browserApiUrl}`)
  console.log(`Server API URL: ${containerApiUrl}`)
} catch (error) {
  console.error('Error updating env:', error.message)
  process.exit(1)
}
