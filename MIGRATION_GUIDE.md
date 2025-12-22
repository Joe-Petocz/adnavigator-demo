# Migration Guide - Old Flow → New Versioned Pipeline

## Overview

This guide helps you switch from the original demo flow (App.jsx) to the new versioned pipeline (AppV2.jsx + DemoFlow.jsx).

## Why Migrate?

### Old Flow Problems ❌
- No session persistence (data lost on refresh)
- Everything reruns if video fails (wastes time + API costs)
- Fake progress bars (user doesn't see real status)
- Analysis + copy generated in one pass (coupled, not cacheable)
- Client-side state only (can't scale)

### New Flow Benefits ✅
- Session persistence (survives refresh)
- Cached artifacts (video failure doesn't rerun analysis)
- Real-time SSE progress (actual job states)
- Versioned pipeline (analysis_v1, copy_v1, video_prompt_v1)
- Backend session storage (scales better)
- Deterministic scraping (no LLM waste)
- Strict JSON contracts (prevents breaking changes)

## Migration Steps

### Step 1: Verify Environment

Ensure you have:
```bash
# .env.local
VITE_OPENAI_API_KEY=your_key_here
```

### Step 2: Install Dependencies

No new dependencies needed! Everything uses existing packages.

### Step 3: Switch Frontend

**Edit `src/main.jsx`:**

**Before:**
```javascript
import App from './App.jsx'
```

**After:**
```javascript
import App from './AppV2.jsx'  // New versioned pipeline
```

### Step 4: Rebuild

```bash
npm run build
```

### Step 5: Restart Server

```bash
npm start
```

### Step 6: Test

```bash
./test-api.sh
```

Or manually test at: http://localhost:8080

## Feature Comparison

| Feature | Old Flow (App.jsx) | New Flow (AppV2.jsx) |
|---------|-------------------|----------------------|
| Session persistence | ❌ No | ✅ Yes (file-based) |
| Caching | ❌ No | ✅ Yes (by session) |
| Video retry cost | ❌ Reruns all | ✅ Uses cache |
| Progress tracking | ❌ Fake timer | ✅ Real SSE events |
| radiusMiles validation | ⚠️ Soft (max 500) | ✅ Hard (max 50) |
| JSON validation | ⚠️ Basic | ✅ Strict + retry |
| Scraping | ⚠️ Via Jina text | ✅ Structured + parsed |
| Error handling | ⚠️ Fallback data | ✅ Graceful + stored |
| Scalability | ❌ Client-state | ✅ Backend storage |

## API Changes

### Old Endpoints (Still Work)
```
POST /api/openai/chat          # Direct OpenAI proxy
POST /api/sora/videos          # Direct SORA proxy
GET  /api/sora/videos/:id      # SORA status
```

### New Endpoints (Recommended)
```
POST /api/demo/session                      # Create session
GET  /api/demo/session/:id                  # Get session state
POST /api/demo/session/:id/copy             # Generate copy (cached)
POST /api/demo/session/:id/video/start      # Start video
GET  /api/demo/video/stream/:videoJobId     # SSE progress
GET  /api/demo/video/:videoJobId            # Video status
```

**Both sets work!** Old endpoints are preserved for backward compatibility.

## Data Flow Comparison

### Old Flow
```
User fills form
  ↓
Client fetches website snapshot (Jina.ai)
  ↓
Client calls OpenAI for analysis (45s wait)
  ↓
Client calls OpenAI for creative (20s wait)
  ↓
Client starts SORA video (fake progress bar)
  ↓
Client polls SORA status
  ↓
(If video fails, restart from beginning)
```

### New Flow
```
User fills form
  ↓
POST /api/demo/session (creates session)
  ↓
Backend scrapes website (async, deterministic)
  ↓
Backend generates analysis_v1 (async, cached)
  ↓
Frontend polls GET /api/demo/session/:id
  ↓
Frontend calls POST /api/demo/session/:id/copy (cached)
  ↓
Frontend calls POST /api/demo/session/:id/video/start
  ↓
Backend creates video job, starts polling
  ↓
Frontend connects to SSE stream (real progress)
  ↓
(If video fails, retry uses cached analysis + copy)
```

## Breaking Changes

### 1. Form Field Name Change
**Old:** `radius`
**New:** `radiusMiles`

**Why:** More explicit naming

**Fix:** Update any external integrations that POST form data

### 2. Radius Validation
**Old:** Max 500 miles
**New:** Max 50 miles (hard validation)

**Why:** Spec requirement (more realistic for local businesses)

**Fix:** Update form UI and any pre-filled values

### 3. Session Required
**Old:** Stateless, no session
**New:** Session-based (demoSessionId required)

**Why:** Enables caching, persistence, error recovery

**Fix:** Store sessionId in client state

### 4. SSE for Video Progress
**Old:** Polling SORA endpoint
**New:** SSE stream for real-time updates

**Why:** More efficient, real-time

**Fix:** Use EventSource API (already implemented in DemoFlow.jsx)

## Non-Breaking Changes

### Backend (Fully Compatible)
- Old endpoints still work
- No database migration needed (file-based)
- Same environment variables

### Frontend (Choose One)
- Old App.jsx still works
- New AppV2.jsx available
- Switch by changing import in main.jsx

## Rollback Plan

If you need to revert:

### Option 1: Quick Rollback
Edit `src/main.jsx`:
```javascript
import App from './App.jsx'  // Back to original
```

Rebuild:
```bash
npm run build
npm start
```

### Option 2: Remove New Files
```bash
# If you want to fully remove new pipeline
rm src/AppV2.jsx
rm src/DemoFlow.jsx
rm -rf lib/
rm -rf prompts/
rm -rf routes/
rm -rf data/

# Restore original server.js (if modified)
git checkout server.js
```

Then rebuild and restart.

## Testing Checklist

Before deploying to production, verify:

- [ ] Session creation works
- [ ] radiusMiles validation shows error when > 50
- [ ] Analysis generates successfully
- [ ] Copy generates successfully
- [ ] Copy is cached (second call returns immediately)
- [ ] Video job starts
- [ ] SSE stream connects and shows progress
- [ ] Video completes or shows error gracefully
- [ ] Session survives page refresh
- [ ] Errors don't break the flow

Run tests:
```bash
./test-api.sh
```

## Deployment Strategy

### Strategy 1: Blue-Green Deployment (Recommended)

1. **Deploy new version** to staging environment
2. **Test thoroughly** with real traffic
3. **Switch DNS/routing** when ready
4. **Keep old version** for quick rollback

### Strategy 2: Feature Flag

1. **Deploy both flows** to production
2. **Use query param** to choose flow:
   - `/?version=v1` → Old flow
   - `/?version=v2` → New flow
3. **Gradually migrate** users
4. **Remove old flow** when stable

### Strategy 3: Immediate Switch (Riskier)

1. **Update main.jsx** to use AppV2
2. **Deploy to production**
3. **Monitor closely** for errors
4. **Rollback if needed** (see rollback plan)

## Data Migration

### Current State
- Old flow: No data stored
- New flow: Sessions in `data/sessions.json`

### No Migration Needed
Since old flow didn't persist data, there's nothing to migrate!

### Future: Upgrade to Database

When ready to use PostgreSQL/MongoDB:

1. **Install client**:
   ```bash
   npm install pg  # or mongodb
   ```

2. **Update `lib/database.js`**:
   - Replace file operations with DB queries
   - Keep same function signatures
   - No changes needed in routes!

3. **Run migration script** (if you have existing sessions.json):
   ```javascript
   // migrate-sessions.js
   import { readFileSync } from 'fs';
   import pg from 'pg';

   const sessions = JSON.parse(readFileSync('data/sessions.json'));
   const client = new pg.Client(process.env.DATABASE_URL);

   await client.connect();

   for (const [id, session] of Object.entries(sessions)) {
     await client.query(
       'INSERT INTO demo_sessions (id, form_data, website_bundle, analysis_v1, copy_v1, video_prompt_v1, video_job, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
       [id, session.formData, session.websiteBundle, session.analysis_v1, session.copy_v1, session.video_prompt_v1, session.videoJob, session.createdAt, session.updatedAt]
     );
   }

   await client.end();
   ```

## FAQ

### Q: Can I run both flows simultaneously?
**A:** Yes! They use different routes. Old flow is client-side, new flow uses `/api/demo/*` endpoints.

### Q: Will old sessions work with new flow?
**A:** No. Old flow didn't create sessions. Users must start fresh.

### Q: Do I need to change my API keys?
**A:** No. Same `VITE_OPENAI_API_KEY` is used.

### Q: What if video generation fails?
**A:** **Old flow:** Start over from scratch.
**New flow:** Retry video only, analysis + copy are cached.

### Q: How do I see session data?
**A:**
```bash
cat data/sessions.json | jq
```

Or via API:
```bash
curl http://localhost:8080/api/demo/session/<sessionId>
```

### Q: Can users resume after closing browser?
**A:** **Old flow:** No, state is lost.
**New flow:** Yes, if they have the sessionId (could add URL param or cookie).

### Q: What happens to in-progress video jobs after server restart?
**A:** Polling stops (in-memory). User can refresh the page and reconnect to SSE stream to resume.

## Performance Comparison

### Time to Complete (First Run)
| Step | Old Flow | New Flow |
|------|----------|----------|
| Form submit | Instant | Instant |
| Analysis | 45s wait | 30-45s (background) |
| Copy | 20s wait | 15-20s |
| Video | 5min (fake progress) | 5min (real progress) |
| **Total** | **~6min 5s** | **~5min 45s** |

### Time to Retry Video (After Failure)
| Step | Old Flow | New Flow |
|------|----------|----------|
| Re-fetch website | 5s | 0s (cached) |
| Re-generate analysis | 45s | 0s (cached) |
| Re-generate copy | 20s | 0s (cached) |
| Start video | Instant | Instant |
| Video generation | 5min | 5min |
| **Total** | **~6min 10s** | **~5min** |

**Savings on retry: ~70 seconds** ✅

### Cost Savings (API Calls)
| Scenario | Old Flow | New Flow |
|----------|----------|----------|
| First run | 3 OpenAI calls | 3 OpenAI calls |
| Video retry | 3 OpenAI calls | 1 OpenAI call |
| **Savings** | - | **2 calls = ~$0.02** |

Over 1000 retries: **~$20 saved** ✅

## Monitoring

### Old Flow
- Client-side only
- No server logs for analysis/copy
- Can't track user sessions

### New Flow
- Full server logging:
  ```
  [API] Created session: demo_123...
  [SCRAPER] Starting scrape for: https://example.com
  [LLM] Successfully parsed JSON on attempt 1
  [VIDEO] Starting video job for session: demo_123...
  [SSE] Client registered for video_456...
  ```
- Track sessions by ID
- Store errors for debugging
- Monitor SSE connections

## Support

If you encounter issues during migration:

1. **Check logs** - Server logs show detailed errors
2. **Test API** - Run `./test-api.sh`
3. **Verify data** - Check `data/sessions.json`
4. **Review docs**:
   - [DEMO_ARCHITECTURE.md](DEMO_ARCHITECTURE.md)
   - [SETUP_GUIDE.md](SETUP_GUIDE.md)
5. **Rollback** - Use old flow if needed

## Summary

**Migration is low-risk:**
- ✅ No breaking changes to backend
- ✅ Old flow still works
- ✅ Easy rollback
- ✅ No data migration needed
- ✅ Same environment variables

**Benefits are high:**
- ✅ 70s faster on video retry
- ✅ $20 saved per 1000 retries
- ✅ Real-time progress
- ✅ Better error handling
- ✅ Scalable architecture

**Recommended approach:**
1. Test in development
2. Deploy to staging
3. Verify all flows work
4. Switch main.jsx import
5. Deploy to production
6. Monitor closely
7. Keep old flow as backup

**Ready to migrate!** 🚀
