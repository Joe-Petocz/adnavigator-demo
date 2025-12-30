#!/bin/bash
# Build script that injects Railway env vars into .env.production

echo "Injecting Railway environment variables into .env.production..."

# Replace placeholder with actual value from Railway
if [ -n "$VITE_OPENAI_API_KEY" ]; then
    sed -i "s/PLACEHOLDER_WILL_BE_REPLACED_BY_RAILWAY/$VITE_OPENAI_API_KEY/g" .env.production
fi

echo "Environment variables set:"
cat .env.production | grep -v API_KEY

echo "Running vite build..."
npm run vite-build
