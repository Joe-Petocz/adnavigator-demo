# Demo Flow Architecture

## Overview

The Demo Flow implements a **stable, versioned pipeline** with strict JSON contracts to prevent breaking changes. Video generation failures do not break business analysis or copy generation due to independent caching.

## Architecture Principles

### 1. **Versioned Pipeline Steps**
Each step is independent with its own prompt and schema:
- `analysis_v1` - Business intelligence analysis
- `copy_v1` - Headlines, primary text, CTAs
- `video_prompt_v1` - SORA2 video prompt and shot plan

### 2. **Caching by Session**
All outputs are cached in the session:
- If video fails, we don't rerun analysis/copy
- Each step checks for cached output before regenerating
- Session state persists in `/data/sessions.json`

### 3. **Strict JSON Validation**
- All LLM calls return valid JSON only (no markdown)
- Schema validation after each generation
- Automatic retry on invalid JSON (max 2 attempts)

### 4. **Real Progress Tracking**
- Video jobs use real provider states (QUEUED, GENERATING, COMPLETED, FAILED)
- SSE streams real-time progress events
- No fake progress bars - only actual job states

## File Structure

```
/Users/joepetocz/Desktop/AdNavigator Demo/
├── server.js                          # Express server with demo routes
├── lib/
│   ├── database.js                    # File-based session storage
│   ├── scraper.js                     # Deterministic website scraping (NO LLM)
│   └── videoWorker.js                 # Video job polling and SSE
├── prompts/
│   └── demoPrompts.js                 # Centralized prompts + schemas
├── routes/
│   └── demoRoutes.js                  # Demo API endpoints
├── src/
│   ├── AppV2.jsx                      # New app using versioned pipeline
│   ├── DemoFlow.jsx                   # Step components (Intake, Intelligence, Copy+Video)
│   └── App.jsx                        # Original app (preserved for reference)
└── data/
    └── sessions.json                  # Session data (auto-created)
```

## API Endpoints

### Session Management

#### `POST /api/demo/session`
Create new demo session
- **Body**: `{ firstName, lastName, email, phone, website, city, state, radiusMiles }`
- **Validation**: `radiusMiles <= 50` (hard max)
- **Returns**: `{ demoSessionId, status: 'processing' }`
- **Side Effect**: Starts async scraping + analysis

#### `GET /api/demo/session/:id`
Get session state and artifacts
- **Returns**:
  ```json
  {
    "demoSessionId": "demo_123...",
    "formData": { ... },
    "websiteAssets": { logos, heroImages, galleryImages, socialLinks },
    "analysis_v1": { businessProfile, swot, idealCustomerProfiles, ... },
    "copy_v1": { headlines, primaryText, ctaRecommendations },
    "videoJob": { videoJobId, state, videoUrl, error }
  }
  ```

### Copy Generation

#### `POST /api/demo/session/:id/copy`
Generate copy_v1 from analysis_v1
- **Requires**: `analysis_v1` must exist
- **Returns**: `copy_v1` JSON
- **Caching**: Returns cached copy if exists

### Video Generation

#### `POST /api/demo/session/:id/video/start`
Start video generation job
- **Body**: `{ selectedHeadline?, selectedCTA? }` (optional)
- **Requires**: `copy_v1` must exist
- **Returns**: `{ videoJobId, state: 'QUEUED' }`
- **Side Effect**: Starts polling worker

#### `GET /api/demo/video/stream/:videoJobId` (SSE)
Stream real-time video progress
- **Headers**: `Content-Type: text/event-stream`
- **Events**:
  ```json
  {
    "videoJobId": "video_123...",
    "state": "GENERATING",
    "message": "Generating your video...",
    "ts": "2025-12-21T...",
    "videoUrl": null,
    "error": null
  }
  ```

#### `GET /api/demo/video/:videoJobId`
Get final video status (polling endpoint)
- **Returns**: `{ videoJobId, state, videoUrl, error }`

## Data Model

### DemoSession
```javascript
{
  id: "demo_1234567890_abc123",
  formData: {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "555-1234",
    website: "https://example.com",
    city: "San Francisco",
    state: "CA",
    radiusMiles: 25
  },
  websiteBundle: {
    url: "https://example.com",
    scrapedAt: "2025-12-21T...",
    homepage: { title, description, content },
    extracted: { textBlocks, headings, images, socialLinks, contactInfo }
  },
  analysis_v1: {
    businessProfile: { ... },
    swot: { ... },
    idealCustomerProfiles: [ ... ],
    websiteAssets: { ... },
    assumptions: [ ... ],
    confidence: { ... }
  },
  copy_v1: {
    headlines: ["...", "...", "..."],
    primaryText: "...",
    ctaRecommendations: [ { cta, why } ],
    creativeNotes: [ ... ]
  },
  video_prompt_v1: {
    videoPrompt: "...",
    shotPlan: [ { time, visual, onScreenText, notes } ],
    negativePrompt: [ ... ],
    renderParams: { durationSeconds, aspectRatio }
  },
  videoJob: {
    videoJobId: "video_1234567890_xyz789",
    providerJobId: "sora_abc123",
    state: "COMPLETED",
    progressEvents: [
      { state: "QUEUED", message: "...", ts: "..." },
      { state: "GENERATING", message: "...", ts: "..." },
      { state: "COMPLETED", message: "...", ts: "..." }
    ],
    videoUrl: "https://...",
    error: null
  },
  createdAt: "2025-12-21T...",
  updatedAt: "2025-12-21T..."
}
```

## Frontend Flow

### Step 1: Intake Form (`IntakeStep`)
- Validates all fields client-side
- Hard validation: `radiusMiles <= 50`
- Shows validation errors inline
- Submits to `POST /api/demo/session`
- Receives `demoSessionId` and transitions to Step 2

### Step 2: Intelligence Screen (`IntelligenceStep`)
- Polls `GET /api/demo/session/:id` every 2 seconds
- Shows loading state while `analysis_v1` is null
- Displays business profile, SWOT, ICPs when ready
- Button to proceed to Step 3

### Step 3: Copy + Video Screen (`CopyAndVideoStep`)
- Fetches session data
- POSTs to `/api/demo/session/:id/copy` to generate copy
- Displays headlines, primary text, CTAs
- Auto-starts video generation via `POST /api/demo/session/:id/video/start`
- Connects to SSE stream at `/api/demo/video/stream/:videoJobId`
- Shows real-time video progress
- Embeds video when `state === 'COMPLETED'`

## Video Job States

Video jobs follow these states:
1. **QUEUED** - Job submitted to provider
2. **GENERATING** - Provider is generating video
3. **ENCODING** - Video encoding (if provider reports it)
4. **UPLOADING** - Uploading to CDN (if provider reports it)
5. **COMPLETED** - Video ready, URL available
6. **FAILED** - Generation failed, error message available

**Important**: These are REAL states from the provider, not fake progress bars.

## Scraping (Deterministic)

Website scraping is done WITHOUT LLM:

1. **Fetch**: Use Jina.ai Reader API to get structured content
2. **Extract**:
   - Text blocks (paragraphs, content)
   - Headings (H1, H2)
   - Images with categorization:
     - Logos (alt text contains "logo", "brand", "header")
     - Hero images (keywords: "hero", "banner", first large images)
     - Gallery images (keywords: "gallery", "portfolio", "work")
   - Social links (Facebook, Instagram, Twitter, LinkedIn, YouTube, TikTok)
   - Contact info (phones, emails, addresses)

3. **Normalize**: Convert to `websiteBundle` format for analysis

**No AI** is used in scraping - only deterministic parsing.

## Error Handling

### LLM Response Errors
1. First attempt: Call OpenAI with strict JSON format
2. If invalid JSON: Retry with "return valid JSON only" repair prompt
3. If still invalid: Fail gracefully, keep session usable, don't retry analysis/copy

### Video Generation Errors
- Video failures do NOT trigger analysis/copy regeneration
- Cached artifacts remain available
- User can retry video only

### Session Not Found
- Return 404 with clear error message
- Frontend shows error state

## Reliability Features

### 1. No Repeated Work
- Check for cached artifacts before regenerating
- `analysis_v1` cached → skip analysis
- `copy_v1` cached → return immediately
- `video_prompt_v1` cached → use for retry

### 2. Request Tracing
All logs include:
- `[DB]` - Database operations
- `[SCRAPER]` - Website scraping
- `[LLM]` - OpenAI API calls
- `[VIDEO]` - Video job lifecycle
- `[SSE]` - Server-sent events
- `[API]` - API endpoint hits
- `[PROCESS]` - Async processing

Example:
```
[API] Created session: demo_1234567890_abc123
[PROCESS] Starting async processing for session: demo_1234567890_abc123
[SCRAPER] Starting scrape for: https://example.com
[SCRAPER] Successfully scraped https://example.com
[LLM] Successfully parsed JSON on attempt 1
[DB] Updated session: demo_1234567890_abc123
[VIDEO] Starting video job for session: demo_1234567890_abc123
[VIDEO] Created video job: video_9876543210_xyz789 (provider: sora_abc123)
[SSE] Client registered for video_9876543210_xyz789
```

### 3. Graceful Fallbacks
- If Jina.ai fails: Return empty snapshot
- If analysis fails: Store error in session, session remains usable
- If video fails: Show error, copy/analysis still available

## Switching to New Pipeline

To use the new versioned pipeline:

### Option 1: Quick Test
```bash
# In src/main.jsx, change import:
import App from './AppV2'  # instead of './App'
```

### Option 2: Gradual Migration
Keep both flows available:
- Old flow: Original App.jsx (works as-is)
- New flow: AppV2.jsx (versioned pipeline)

### Option 3: Full Replacement
```bash
# Backup old app
mv src/App.jsx src/App.legacy.jsx

# Replace with new
mv src/AppV2.jsx src/App.jsx
```

## Testing the Pipeline

### 1. Test Session Creation
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

# Response: { "demoSessionId": "demo_...", "status": "processing" }
```

### 2. Test Session Polling
```bash
curl http://localhost:8080/api/demo/session/<demoSessionId>

# Initially: analysis_v1 is null
# After ~30s: analysis_v1 is populated
```

### 3. Test Copy Generation
```bash
curl -X POST http://localhost:8080/api/demo/session/<demoSessionId>/copy

# Response: { headlines: [...], primaryText: "...", ctaRecommendations: [...] }
```

### 4. Test Video Start
```bash
curl -X POST http://localhost:8080/api/demo/session/<demoSessionId>/video/start \
  -H "Content-Type: application/json" \
  -d '{
    "selectedHeadline": "Your Campaign Headline",
    "selectedCTA": "Get Started"
  }'

# Response: { "videoJobId": "video_...", "state": "QUEUED" }
```

### 5. Test SSE Stream
```bash
curl -N http://localhost:8080/api/demo/video/stream/<videoJobId>

# Streams:
# data: {"type":"connected","videoJobId":"video_..."}
# data: {"videoJobId":"video_...","state":"QUEUED","message":"..."}
# data: {"videoJobId":"video_...","state":"GENERATING","message":"..."}
# ...
```

## Caching Verification

To verify caching works:

1. Create a session and wait for analysis
2. Call `/api/demo/session/:id/copy` twice
3. Check logs - second call should show "Returning cached copy_v1"
4. Restart server
5. Call `/api/demo/session/:id` - session data persists

## Upgrading to Production Database

To replace file-based DB with PostgreSQL/MongoDB:

1. Install database client:
   ```bash
   npm install pg  # PostgreSQL
   # or
   npm install mongodb  # MongoDB
   ```

2. Update `lib/database.js`:
   - Replace `readSessions()`/`writeSessions()` with DB queries
   - Keep the same function signatures
   - No changes needed in routes!

3. Create schema:
   ```sql
   CREATE TABLE demo_sessions (
     id TEXT PRIMARY KEY,
     form_data JSONB,
     website_bundle JSONB,
     analysis_v1 JSONB,
     copy_v1 JSONB,
     video_prompt_v1 JSONB,
     video_job JSONB,
     created_at TIMESTAMPTZ,
     updated_at TIMESTAMPTZ
   );
   ```

## Environment Variables

Required:
- `VITE_OPENAI_API_KEY` - OpenAI API key (used server-side)

Optional:
- `PORT` - Server port (default: 8080)

## Non-Negotiables ✅

- [x] Split pipeline into independent steps (analysis_v1, copy_v1, video_prompt_v1)
- [x] Cache outputs by demoSessionId
- [x] All LLM calls return valid JSON only
- [x] Video failures don't rerun analysis/copy
- [x] Validate radiusMiles <= 50 (hard max)
- [x] Real progress tracking (no fake timers)
- [x] SSE for real-time video updates
- [x] Deterministic scraping (NO LLM)
- [x] Centralized prompts in one file
- [x] Request tracing with sessionId/videoJobId
- [x] Strict JSON validation with retry logic
- [x] Graceful error handling
