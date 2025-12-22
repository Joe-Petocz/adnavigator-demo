/**
 * Demo Session API Routes
 * Versioned pipeline endpoints for stable, cacheable outputs
 */

import express from 'express';
import {
  createSession,
  getSession,
  updateSession,
  updateVideoJob,
} from '../lib/database.js';
import { scrapeWebsite, normalizeWebsiteBundle } from '../lib/scraper.js';
import {
  ANALYSIS_V1_SYSTEM,
  buildAnalysisV1Prompt,
  COPY_V1_SYSTEM,
  buildCopyV1Prompt,
  VIDEO_PROMPT_V1_SYSTEM,
  buildVideoPromptV1Prompt,
  callOpenAIWithSchema,
  validateAnalysisV1,
  validateCopyV1,
  validateVideoPromptV1,
} from '../prompts/demoPrompts.js';
import {
  startVideoJob,
  registerSSEClient,
  getVideoStatus,
} from '../lib/videoWorker.js';

const router = express.Router();

/**
 * POST /api/demo/session
 *
 * Create new demo session
 * Validates form, creates session, starts scraping + analysis
 */
router.post('/session', async (req, res) => {
  try {
    const formData = req.body;

    // Validate required fields
    const required = ['firstName', 'lastName', 'email', 'phone', 'website', 'city', 'state', 'radiusMiles'];
    for (const field of required) {
      if (!formData[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Validate radiusMiles <= 50
    if (formData.radiusMiles > 50) {
      return res.status(400).json({
        error: 'radiusMiles must be 50 or less',
        field: 'radiusMiles',
        value: formData.radiusMiles,
      });
    }

    // Validate website URL
    try {
      new URL(formData.website);
    } catch {
      return res.status(400).json({ error: 'Invalid website URL' });
    }

    // Create session
    const session = await createSession(formData);

    console.log(`[API] Created session: ${session.id}`);

    // Start async processing (scraping + analysis)
    processSessionAsync(session.id, formData);

    res.json({
      demoSessionId: session.id,
      status: 'processing',
    });
  } catch (error) {
    console.error('[API] Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/demo/session/:id
 *
 * Get session state and available artifacts
 */
router.get('/session/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await getSession(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Return session state with available artifacts
    res.json({
      demoSessionId: session.id,
      formData: session.formData,
      websiteAssets: session.analysis_v1?.websiteAssets || null,
      analysis_v1: session.analysis_v1 || null,
      copy_v1: session.copy_v1 || null,
      videoJob: session.videoJob
        ? {
            videoJobId: session.videoJob.videoJobId,
            state: session.videoJob.state,
            videoUrl: session.videoJob.videoUrl,
            error: session.videoJob.error,
          }
        : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('[API] Error getting session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/demo/session/:id/copy
 *
 * Generate copy_v1 from analysis_v1
 */
router.post('/session/:id/copy', async (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const session = await getSession(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if copy_v1 already exists (cached)
    if (session.copy_v1) {
      console.log(`[API] Returning cached copy_v1 for session: ${id}`);
      return res.json(session.copy_v1);
    }

    // Require analysis_v1 to exist
    if (!session.analysis_v1) {
      return res.status(400).json({ error: 'analysis_v1 not ready. Wait for analysis to complete.' });
    }

    console.log(`[API] Generating copy_v1 for session: ${id}`);

    // Generate copy_v1
    const copyPrompt = buildCopyV1Prompt(session.analysis_v1);
    const copy_v1 = await callOpenAIWithSchema(COPY_V1_SYSTEM, copyPrompt, apiKey);

    // Validate output
    validateCopyV1(copy_v1);

    // Cache it
    await updateSession(id, { copy_v1 });

    console.log(`[API] Generated and cached copy_v1 for session: ${id}`);

    res.json(copy_v1);
  } catch (error) {
    console.error('[API] Error generating copy:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/demo/session/:id/video/start
 *
 * Start video generation job
 * Requires copy_v1 (or selected headline/CTA)
 */
router.post('/session/:id/video/start', async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedHeadline, selectedCTA } = req.body;
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const session = await getSession(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Require copy_v1 to exist
    if (!session.copy_v1) {
      return res.status(400).json({ error: 'copy_v1 not ready. Generate copy first.' });
    }

    // Use selected headline or default to first
    const headline = selectedHeadline || session.copy_v1.headlines[0];
    const cta = selectedCTA || session.copy_v1.ctaRecommendations[0]?.cta || 'Get Started';

    console.log(`[API] Starting video job for session: ${id}`);

    // Build video prompt
    const assetsToUse = {
      logoUrl: session.analysis_v1?.websiteAssets?.logos?.[0] || null,
      imageUrls: [
        ...(session.analysis_v1?.websiteAssets?.heroImages || []),
        ...(session.analysis_v1?.websiteAssets?.galleryImages || []),
      ].slice(0, 5),
    };

    const videoPromptPayload = buildVideoPromptV1Prompt(
      session.analysis_v1,
      session.copy_v1,
      { headline, cta },
      assetsToUse
    );

    const video_prompt_v1 = await callOpenAIWithSchema(
      VIDEO_PROMPT_V1_SYSTEM,
      videoPromptPayload,
      apiKey
    );

    // Validate output
    validateVideoPromptV1(video_prompt_v1);

    // Cache video prompt
    await updateSession(id, { video_prompt_v1 });

    console.log(`[API] Generated video_prompt_v1 for session: ${id}`);

    // Start video job
    const videoJob = await startVideoJob(
      id,
      video_prompt_v1.videoPrompt,
      video_prompt_v1.renderParams,
      apiKey
    );

    res.json({
      videoJobId: videoJob.videoJobId,
      state: videoJob.state,
    });
  } catch (error) {
    console.error('[API] Error starting video:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/demo/video/stream/:videoJobId (SSE)
 *
 * Stream real-time video job progress events
 */
router.get('/video/stream/:videoJobId', async (req, res) => {
  const { videoJobId } = req.params;

  console.log(`[API] SSE stream requested for video job: ${videoJobId}`);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Register client for updates
  registerSSEClient(videoJobId, res);

  // Send current status immediately
  try {
    const status = await getVideoStatus(videoJobId);

    if (status) {
      res.write(
        `data: ${JSON.stringify({
          videoJobId,
          state: status.state,
          message: getMessageForState(status.state),
          ts: new Date().toISOString(),
          videoUrl: status.videoUrl,
          error: status.error,
        })}\n\n`
      );
    }
  } catch (error) {
    console.error('[API] Error getting initial video status:', error);
  }

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000); // 30 seconds

  res.on('close', () => {
    clearInterval(heartbeat);
  });
});

/**
 * GET /api/demo/video/:videoJobId
 *
 * Get final video status (polling endpoint)
 */
router.get('/video/:videoJobId', async (req, res) => {
  try {
    const { videoJobId } = req.params;

    const status = await getVideoStatus(videoJobId);

    if (!status) {
      return res.status(404).json({ error: 'Video job not found' });
    }

    res.json({
      videoJobId: status.videoJobId,
      state: status.state,
      videoUrl: status.videoUrl,
      error: status.error,
    });
  } catch (error) {
    console.error('[API] Error getting video status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Async processing: scrape website + generate analysis
 * Runs in background after session creation
 */
async function processSessionAsync(sessionId, formData) {
  const apiKey = process.env.VITE_OPENAI_API_KEY;

  try {
    console.log(`[PROCESS] Starting async processing for session: ${sessionId}`);

    // Step 1: Scrape website
    console.log(`[PROCESS] Scraping website: ${formData.website}`);
    const scraped = await scrapeWebsite(formData.website);
    const websiteBundle = normalizeWebsiteBundle(scraped);

    await updateSession(sessionId, { websiteBundle });
    console.log(`[PROCESS] Website scraped and cached for session: ${sessionId}`);

    // Step 2: Generate analysis_v1
    console.log(`[PROCESS] Generating analysis_v1 for session: ${sessionId}`);
    const analysisPrompt = buildAnalysisV1Prompt(formData, websiteBundle);
    const analysis_v1 = await callOpenAIWithSchema(ANALYSIS_V1_SYSTEM, analysisPrompt, apiKey);

    // Validate output
    validateAnalysisV1(analysis_v1);

    await updateSession(sessionId, { analysis_v1 });
    console.log(`[PROCESS] Analysis_v1 generated and cached for session: ${sessionId}`);
  } catch (error) {
    console.error(`[PROCESS] Error processing session ${sessionId}:`, error);

    // Store error in session
    await updateSession(sessionId, {
      error: {
        message: error.message,
        step: 'analysis',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Helper: Get message for video state
 */
function getMessageForState(state) {
  const messages = {
    QUEUED: 'Your video is in the queue...',
    GENERATING: 'Generating your video...',
    ENCODING: 'Encoding video...',
    UPLOADING: 'Uploading video...',
    COMPLETED: 'Video ready!',
    FAILED: 'Video generation failed',
  };

  return messages[state] || 'Processing...';
}

export default router;
