import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  // Use process.env directly (Railway injects env vars here)
  console.log('🔍 Build-time environment check:')
  console.log('VITE_FACEBOOK_APP_ID:', process.env.VITE_FACEBOOK_APP_ID ? '✅ Set' : '❌ Missing')
  console.log('VITE_FACEBOOK_APP_SECRET:', process.env.VITE_FACEBOOK_APP_SECRET ? '✅ Set' : '❌ Missing')
  console.log('VITE_OPENAI_API_KEY:', process.env.VITE_OPENAI_API_KEY ? '✅ Set' : '❌ Missing')

  return {
    plugins: [react()],
    // Explicitly define env vars so they're baked into the build
    define: {
      'import.meta.env.VITE_FACEBOOK_APP_ID': JSON.stringify(process.env.VITE_FACEBOOK_APP_ID),
      'import.meta.env.VITE_FACEBOOK_APP_SECRET': JSON.stringify(process.env.VITE_FACEBOOK_APP_SECRET),
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(process.env.VITE_OPENAI_API_KEY),
    }
  }
})
