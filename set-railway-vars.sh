#!/bin/bash

# Script to set Railway environment variables
# Run this after: railway login

echo "Setting Railway environment variables..."
echo ""

# Read values from .env.local
source .env.local

# Set variables in Railway
echo "Setting VITE_FACEBOOK_APP_ID..."
railway variables --set VITE_FACEBOOK_APP_ID="$VITE_FACEBOOK_APP_ID"

echo "Setting VITE_FACEBOOK_APP_SECRET..."
railway variables --set VITE_FACEBOOK_APP_SECRET="$VITE_FACEBOOK_APP_SECRET"

echo "Setting VITE_OPENAI_API_KEY..."
railway variables --set VITE_OPENAI_API_KEY="$VITE_OPENAI_API_KEY"

echo ""
echo "✅ All environment variables set!"
echo ""
echo "Now triggering redeploy..."
railway up --detach

echo ""
echo "✅ Deployment triggered!"
echo "Visit https://railway.app to monitor the deployment."
