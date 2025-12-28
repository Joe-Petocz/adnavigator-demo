import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  console.log('🔍 Build-time environment check:')
  console.log('VITE_FACEBOOK_APP_ID:', env.VITE_FACEBOOK_APP_ID ? '✅ Set' : '❌ Missing')
  console.log('VITE_FACEBOOK_APP_SECRET:', env.VITE_FACEBOOK_APP_SECRET ? '✅ Set' : '❌ Missing')
  console.log('VITE_OPENAI_API_KEY:', env.VITE_OPENAI_API_KEY ? '✅ Set' : '❌ Missing')

  return {
    plugins: [react()],
    // Vite automatically handles VITE_ prefixed env vars
    // But we can explicitly define them for clarity
    define: {
      'import.meta.env.VITE_FACEBOOK_APP_ID': JSON.stringify(env.VITE_FACEBOOK_APP_ID),
      'import.meta.env.VITE_FACEBOOK_APP_SECRET': JSON.stringify(env.VITE_FACEBOOK_APP_SECRET),
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY),
    }
  }
})
