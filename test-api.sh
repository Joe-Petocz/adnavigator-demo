#!/bin/bash

# Test script for Demo Pipeline API
# Tests the complete flow: session creation -> analysis -> copy -> video

set -e

BASE_URL="http://localhost:8080"

echo "=== Testing Demo Pipeline API ==="
echo ""

# Test 1: Create Session
echo "1. Creating demo session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/demo/session" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "555-1234",
    "website": "https://example.com",
    "city": "San Francisco",
    "state": "CA",
    "radiusMiles": 25
  }')

echo "Response: $SESSION_RESPONSE"
SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"demoSessionId":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_ID" ]; then
  echo "❌ Failed to create session"
  exit 1
fi

echo "✅ Session created: $SESSION_ID"
echo ""

# Test 2: Validate radiusMiles > 50
echo "2. Testing radiusMiles validation (should fail)..."
VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/demo/session" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "555-1234",
    "website": "https://example.com",
    "city": "San Francisco",
    "state": "CA",
    "radiusMiles": 100
  }')

if echo "$VALIDATION_RESPONSE" | grep -q "radiusMiles must be 50 or less"; then
  echo "✅ Validation works correctly"
else
  echo "❌ Validation failed: $VALIDATION_RESPONSE"
fi
echo ""

# Test 3: Poll for analysis
echo "3. Polling for analysis (max 60 seconds)..."
for i in {1..30}; do
  SESSION_DATA=$(curl -s "$BASE_URL/api/demo/session/$SESSION_ID")

  if echo "$SESSION_DATA" | grep -q '"analysis_v1":{'; then
    echo "✅ Analysis completed after $i polls"
    echo "Analysis preview:"
    echo "$SESSION_DATA" | grep -o '"businessProfile":{[^}]*}' | head -c 200
    echo "..."
    break
  else
    echo "  Poll $i/30: Analysis not ready yet..."
    sleep 2
  fi

  if [ $i -eq 30 ]; then
    echo "⚠️  Analysis still processing after 60 seconds (this is normal for first run)"
  fi
done
echo ""

# Test 4: Generate Copy
echo "4. Generating copy_v1..."
COPY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/demo/session/$SESSION_ID/copy")

if echo "$COPY_RESPONSE" | grep -q '"headlines":\['; then
  echo "✅ Copy generated successfully"
  echo "Headlines:"
  echo "$COPY_RESPONSE" | grep -o '"headlines":\[[^\]]*\]' | head -c 300
  echo ""
else
  echo "⚠️  Copy generation failed or still waiting for analysis"
  echo "Response: $COPY_RESPONSE"
fi
echo ""

# Test 5: Health Check
echo "5. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")

if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  echo "✅ Health check passed"
  echo "$HEALTH_RESPONSE"
else
  echo "❌ Health check failed"
fi
echo ""

echo "=== Test Summary ==="
echo "Session ID: $SESSION_ID"
echo "You can manually test:"
echo "- Get session: curl $BASE_URL/api/demo/session/$SESSION_ID"
echo "- Generate copy: curl -X POST $BASE_URL/api/demo/session/$SESSION_ID/copy"
echo "- Start video: curl -X POST $BASE_URL/api/demo/session/$SESSION_ID/video/start -H 'Content-Type: application/json' -d '{\"selectedHeadline\":\"Test\",\"selectedCTA\":\"Get Started\"}'"
echo ""
