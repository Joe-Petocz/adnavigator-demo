# Setup Guide - Demo Pipeline

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env.local` file (or update existing):

```bash
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Choose Your Frontend

#### Option A: Use New Versioned Pipeline (Recommended)

Edit `src/main.jsx`:

```javascript
import App from './AppV2.jsx'  // ← Use new versioned pipeline
```

#### Option B: Keep Original Flow

No changes needed - uses `src/App.jsx` by default

### 4. Start Development Server

```bash
# Build frontend
npm run build

# Start backend server
npm start
```

Server runs on: http://localhost:8080

### 5. Test the API

```bash
# Run automated tests
./test-api.sh

# Or manually test with curl
curl -X POST http://localhost:8080/api/demo/session \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "website": "https://example.com",
    "city": "San Francisco",
    "state": "CA",
    "radiusMiles": 25
  }'
```

## Architecture Overview

### Old Flow (App.jsx)
- Client-side state only
- No persistence
- Analysis + copy generated in one pass
- Fake progress bars for video

### New Flow (AppV2.jsx + DemoFlow.jsx)
- ✅ Backend session storage
- ✅ Versioned pipeline (analysis_v1, copy_v1, video_prompt_v1)
- ✅ Caching by session (video failure doesn't rerun analysis)
- ✅ Real-time video progress via SSE
- ✅ Strict JSON validation
- ✅ Deterministic scraping (no LLM)

## File Structure

```
AdNavigator Demo/
├── server.js                      # Express server (updated with demo routes)
├── lib/
│   ├── database.js               # Session storage (file-based)
│   ├── scraper.js                # Website scraping (deterministic)
│   └── videoWorker.js            # Video job polling + SSE
├── prompts/
│   └── demoPrompts.js            # Centralized prompts + schemas
├── routes/
│   └── demoRoutes.js             # Demo API endpoints
├── src/
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Original app (preserved)
│   ├── AppV2.jsx                 # New versioned pipeline app
│   └── DemoFlow.jsx              # Step components
├── data/
│   └── sessions.json             # Session data (auto-created)
├── test-api.sh                   # API test script
├── DEMO_ARCHITECTURE.md          # Full architecture docs
└── SETUP_GUIDE.md                # This file
```

## API Endpoints

All new endpoints are under `/api/demo`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/demo/session` | Create new session |
| GET | `/api/demo/session/:id` | Get session state |
| POST | `/api/demo/session/:id/copy` | Generate copy_v1 |
| POST | `/api/demo/session/:id/video/start` | Start video job |
| GET | `/api/demo/video/stream/:videoJobId` | SSE video progress |
| GET | `/api/demo/video/:videoJobId` | Get video status |

Old endpoints still work:
- `POST /api/openai/chat` (legacy)
- `POST /api/sora/videos` (legacy)
- `GET /api/sora/videos/:id` (legacy)

## Testing

### Manual Testing

1. **Create Session**
   ```bash
   curl -X POST http://localhost:8080/api/demo/session \
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
     }'
   ```

   Response: `{ "demoSessionId": "demo_...", "status": "processing" }`

2. **Poll Session** (wait for analysis)
   ```bash
   curl http://localhost:8080/api/demo/session/<demoSessionId>
   ```

   Initially: `analysis_v1: null`
   After ~30s: `analysis_v1: { businessProfile, swot, ... }`

3. **Generate Copy**
   ```bash
   curl -X POST http://localhost:8080/api/demo/session/<demoSessionId>/copy
   ```

   Response: `{ headlines: [...], primaryText: "...", ctaRecommendations: [...] }`

4. **Start Video**
   ```bash
   curl -X POST http://localhost:8080/api/demo/session/<demoSessionId>/video/start \
     -H "Content-Type: application/json" \
     -d '{
       "selectedHeadline": "Your Headline",
       "selectedCTA": "Get Started"
     }'
   ```

   Response: `{ "videoJobId": "video_...", "state": "QUEUED" }`

5. **Stream Video Progress** (SSE)
   ```bash
   curl -N http://localhost:8080/api/demo/video/stream/<videoJobId>
   ```

   Streams events:
   ```
   data: {"videoJobId":"video_...","state":"QUEUED","message":"..."}
   data: {"videoJobId":"video_...","state":"GENERATING","message":"..."}
   ```

### Automated Testing

```bash
./test-api.sh
```

This tests:
- ✅ Session creation
- ✅ radiusMiles validation (max 50)
- ✅ Analysis generation
- ✅ Copy generation
- ✅ Health check

## Validation Rules

### Intake Form
- All fields required: firstName, lastName, email, phone, website, city, state, radiusMiles
- `radiusMiles` must be:
  - A number
  - Greater than 0
  - **Less than or equal to 50** (hard max)
- `website` must be a valid URL
- `state` must be 2 characters

Example validation error:
```json
{
  "error": "radiusMiles must be 50 or less",
  "field": "radiusMiles",
  "value": 100
}
```

## Caching Behavior

### Analysis Caching
Once `analysis_v1` is generated for a session, it's never regenerated.

Test caching:
```bash
# Create session
SESSION_ID=$(curl -s -X POST http://localhost:8080/api/demo/session -H "Content-Type: application/json" -d '{"firstName":"Test","lastName":"User","email":"test@example.com","phone":"555-1234","website":"https://example.com","city":"SF","state":"CA","radiusMiles":25}' | grep -o '"demoSessionId":"[^"]*' | cut -d'"' -f4)

# Wait for analysis (poll until analysis_v1 is not null)
while ! curl -s http://localhost:8080/api/demo/session/$SESSION_ID | grep -q '"analysis_v1":{'; do
  sleep 2
done

# Generate copy twice - second call uses cache
curl -X POST http://localhost:8080/api/demo/session/$SESSION_ID/copy
curl -X POST http://localhost:8080/api/demo/session/$SESSION_ID/copy

# Check server logs - you'll see "Returning cached copy_v1" on second call
```

### Video Retry (Cache)
If video generation fails, you can retry without rerunning analysis/copy:

```bash
# Video prompt is cached, so restart uses the same prompt
curl -X POST http://localhost:8080/api/demo/session/$SESSION_ID/video/start \
  -H "Content-Type: application/json" \
  -d '{"selectedHeadline":"Same headline","selectedCTA":"Same CTA"}'
```

## Debugging

### Server Logs

All operations are logged with prefixes:

```
[DB]       - Database operations
[SCRAPER]  - Website scraping
[LLM]      - OpenAI API calls
[VIDEO]    - Video job lifecycle
[SSE]      - Server-sent events
[API]      - API requests
[PROCESS]  - Async processing
```

Example flow:
```
[API] Created session: demo_1234567890_abc123
[PROCESS] Starting async processing for session: demo_1234567890_abc123
[SCRAPER] Starting scrape for: https://example.com
[SCRAPER] Successfully scraped https://example.com
[SCRAPER] - Content length: 42 blocks
[SCRAPER] - Images found: 8
[SCRAPER] - Social links: 3
[DB] Updated session: demo_1234567890_abc123
[LLM] Successfully parsed JSON on attempt 1
[DB] Updated session: demo_1234567890_abc123
[API] Generated and cached copy_v1 for session: demo_1234567890_abc123
[VIDEO] Starting video job for session: demo_1234567890_abc123
[VIDEO] Created video job: video_9876543210_xyz789 (provider: sora_abc123)
[SSE] Client registered for video_9876543210_xyz789
```

### Check Session Data

Sessions are stored in `data/sessions.json`:

```bash
cat data/sessions.json | jq
```

### Check for Errors

If analysis fails, the error is stored in the session:

```bash
curl http://localhost:8080/api/demo/session/$SESSION_ID | jq .error
```

## Troubleshooting

### "API key not configured"
- Check `.env.local` has `VITE_OPENAI_API_KEY=your_key`
- Restart server after adding env vars

### "Analysis timeout"
- Jina.ai or OpenAI may be slow
- Check network connection
- Review server logs for specific errors

### "Session not found"
- Session ID may be incorrect
- Check `data/sessions.json` exists
- Ensure server hasn't restarted (in-memory poller state lost)

### "radiusMiles must be 50 or less"
- This is intentional validation
- Update form to use value <= 50

### Video stuck in "QUEUED"
- SORA API may not be available yet (expected)
- Check server logs for provider errors
- Video worker polls for 10 minutes before timeout

## Production Deployment

### Environment Setup

1. Set production environment variables:
   ```bash
   VITE_OPENAI_API_KEY=your_production_key
   PORT=8080
   ```

2. Build frontend:
   ```bash
   npm run build
   ```

3. Start server:
   ```bash
   npm start
   ```

### Database Upgrade

The file-based database (`data/sessions.json`) works for demos but should be upgraded for production.

To use PostgreSQL:

1. Install client:
   ```bash
   npm install pg
   ```

2. Create schema:
   ```sql
   CREATE TABLE demo_sessions (
     id TEXT PRIMARY KEY,
     form_data JSONB NOT NULL,
     website_bundle JSONB,
     analysis_v1 JSONB,
     copy_v1 JSONB,
     video_prompt_v1 JSONB,
     video_job JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_sessions_created ON demo_sessions(created_at);
   ```

3. Update `lib/database.js` to use PostgreSQL (keep same function signatures)

### Railway Deployment

Current Railway setup should work as-is:

1. Push to GitHub
2. Railway auto-deploys from main branch
3. Set `VITE_OPENAI_API_KEY` in Railway env vars
4. Build command: `npm run build`
5. Start command: `npm start`

## Switching Between Old and New Flow

### Use New Pipeline (Recommended)

Edit `src/main.jsx`:
```javascript
import App from './AppV2.jsx'  // New versioned pipeline
```

Rebuild:
```bash
npm run build
npm start
```

### Revert to Old Flow

Edit `src/main.jsx`:
```javascript
import App from './App.jsx'  // Original flow
```

Rebuild:
```bash
npm run build
npm start
```

### Run Both Flows

Keep both available by:
1. Duplicating the frontend on different routes
2. Or: Let users choose which flow to use

## Next Steps

1. **Test the pipeline**
   - Run `./test-api.sh`
   - Try frontend at http://localhost:8080

2. **Review architecture**
   - Read `DEMO_ARCHITECTURE.md` for full details

3. **Deploy to production**
   - Set up production database
   - Configure environment variables
   - Deploy to Railway

4. **Extend functionality**
   - Add user authentication
   - Store campaign history
   - Add payment processing

## Support

For issues or questions:
- Check server logs for detailed error messages
- Review `DEMO_ARCHITECTURE.md` for architecture details
- Test API endpoints manually with curl
- Check `data/sessions.json` for session state
