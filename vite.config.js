import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  // Log environment variables during build to verify they're loaded
  console.log('🔍 Build-time environment check:')
  console.log('VITE_FACEBOOK_APP_ID:', env.VITE_FACEBOOK_APP_ID ? '✅ Set' : '❌ Missing')
  console.log('VITE_OPENAI_API_KEY:', env.VITE_OPENAI_API_KEY ? '✅ Set' : '❌ Missing')

  return {
    plugins: [react()],
    // Make sure env vars are available
    define: {
      'import.meta.env.VITE_FACEBOOK_APP_ID': JSON.stringify(env.VITE_FACEBOOK_APP_ID),
      'import.meta.env.VITE_FACEBOOK_APP_SECRET': JSON.stringify(env.VITE_FACEBOOK_APP_SECRET),
    }
  }
})
