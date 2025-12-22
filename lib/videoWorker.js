/**
 * Video Job Worker
 * Polls provider for video generation status and emits real-time events
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import { getVideoJobById, updateVideoJob } from './database.js';

// Active polling jobs
const activePollers = new Map();

// SSE clients waiting for updates
const sseClients = new Map();

/**
 * Start a video generation job
 *
 * @param {string} sessionId - Demo session ID
 * @param {string} videoPrompt - SORA prompt text
 * @param {Object} renderParams - Duration and aspect ratio
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} - Video job info
 */
export async function startVideoJob(sessionId, videoPrompt, renderParams, apiKey) {
  console.log(`[VIDEO] Starting video job for session: ${sessionId}`);

  try {
    // Create SORA video job
    const formData = new FormData();
    formData.append('model', 'sora-2-pro');
    formData.append('prompt', videoPrompt);
    formData.append('seconds', String(renderParams.durationSeconds || 8));
    formData.append('size', renderParams.aspectRatio || '720x1280');

    const response = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`SORA API error: ${response.status} - ${JSON.stringify(data)}`);
    }

    const providerJobId = data.id;
    const videoJobId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[VIDEO] Created video job: ${videoJobId} (provider: ${providerJobId})`);

    // Store video job in session
    await updateVideoJob(sessionId, {
      videoJobId,
      providerJobId,
      state: 'QUEUED',
      progressEvent: {
        state: 'QUEUED',
        message: 'Video generation queued',
      },
    });

    // Start polling for status
    startPolling(videoJobId, sessionId, providerJobId, apiKey);

    return {
      videoJobId,
      providerJobId,
      state: 'QUEUED',
    };
  } catch (error) {
    console.error(`[VIDEO] Error starting video job:`, error.message);
    throw error;
  }
}

/**
 * Start polling for video status
 */
function startPolling(videoJobId, sessionId, providerJobId, apiKey) {
  if (activePollers.has(videoJobId)) {
    console.log(`[VIDEO] Already polling for ${videoJobId}`);
    return;
  }

  console.log(`[VIDEO] Starting poller for ${videoJobId}`);

  let pollCount = 0;
  const maxPolls = 120; // 10 minutes at 5-second intervals
  const pollInterval = 5000; // 5 seconds

  const poller = setInterval(async () => {
    pollCount++;

    try {
      const status = await checkVideoStatus(providerJobId, apiKey);

      console.log(`[VIDEO] Poll ${pollCount}/${maxPolls} for ${videoJobId}: ${status.state}`);

      // Update session with new state
      await updateVideoJob(sessionId, {
        state: status.state,
        progressEvent: {
          state: status.state,
          message: status.message,
        },
      });

      // Emit SSE event
      emitSSE(videoJobId, {
        videoJobId,
        state: status.state,
        message: status.message,
        ts: new Date().toISOString(),
        videoUrl: status.videoUrl || null,
        error: status.error || null,
      });

      // Check if job is complete or failed
      if (status.state === 'COMPLETED') {
        console.log(`[VIDEO] Job ${videoJobId} completed: ${status.videoUrl}`);

        await updateVideoJob(sessionId, {
          state: 'COMPLETED',
          videoUrl: status.videoUrl,
          progressEvent: {
            state: 'COMPLETED',
            message: 'Video generation completed',
          },
        });

        emitSSE(videoJobId, {
          videoJobId,
          state: 'COMPLETED',
          message: 'Video generation completed',
          ts: new Date().toISOString(),
          videoUrl: status.videoUrl,
          error: null,
        });

        stopPolling(videoJobId);
      } else if (status.state === 'FAILED') {
        console.error(`[VIDEO] Job ${videoJobId} failed: ${status.error}`);

        await updateVideoJob(sessionId, {
          state: 'FAILED',
          error: status.error,
          progressEvent: {
            state: 'FAILED',
            message: status.error || 'Video generation failed',
          },
        });

        emitSSE(videoJobId, {
          videoJobId,
          state: 'FAILED',
          message: status.error || 'Video generation failed',
          ts: new Date().toISOString(),
          videoUrl: null,
          error: status.error,
        });

        stopPolling(videoJobId);
      } else if (pollCount >= maxPolls) {
        // Timeout
        console.error(`[VIDEO] Job ${videoJobId} timed out after ${maxPolls} polls`);

        await updateVideoJob(sessionId, {
          state: 'FAILED',
          error: 'Video generation timed out',
          progressEvent: {
            state: 'FAILED',
            message: 'Video generation timed out',
          },
        });

        emitSSE(videoJobId, {
          videoJobId,
          state: 'FAILED',
          message: 'Video generation timed out',
          ts: new Date().toISOString(),
          videoUrl: null,
          error: 'Timeout after 10 minutes',
        });

        stopPolling(videoJobId);
      }
    } catch (error) {
      console.error(`[VIDEO] Error polling ${videoJobId}:`, error.message);

      // Don't stop polling on transient errors, only stop on final states
      if (pollCount >= maxPolls) {
        await updateVideoJob(sessionId, {
          state: 'FAILED',
          error: error.message,
          progressEvent: {
            state: 'FAILED',
            message: error.message,
          },
        });

        stopPolling(videoJobId);
      }
    }
  }, pollInterval);

  activePollers.set(videoJobId, poller);
}

/**
 * Stop polling for a video job
 */
function stopPolling(videoJobId) {
  const poller = activePollers.get(videoJobId);
  if (poller) {
    clearInterval(poller);
    activePollers.delete(videoJobId);
    console.log(`[VIDEO] Stopped polling for ${videoJobId}`);
  }
}

/**
 * Check video status from provider
 */
async function checkVideoStatus(providerJobId, apiKey) {
  const response = await fetch(`https://api.openai.com/v1/videos/${providerJobId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle 404 (not found), 401 (unauthorized), etc.
    if (response.status === 404 || response.status === 401 || response.status === 403 || response.status === 405) {
      // SORA API not available yet
      return {
        state: 'FAILED',
        message: 'SORA API not available yet (demo mode)',
        error: `API returned ${response.status}`,
      };
    }

    throw new Error(`Provider API error: ${response.status}`);
  }

  // Map provider status to our states
  const providerStatus = data.status || 'unknown';

  // OpenAI SORA states: queued, processing, completed, failed
  const stateMap = {
    queued: 'QUEUED',
    processing: 'GENERATING',
    completed: 'COMPLETED',
    failed: 'FAILED',
  };

  const state = stateMap[providerStatus] || 'GENERATING';

  return {
    state,
    message: getMessageForState(state),
    videoUrl: data.output?.url || null,
    error: data.error || null,
  };
}

/**
 * Get user-friendly message for state
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

/**
 * Register SSE client for video updates
 */
export function registerSSEClient(videoJobId, res) {
  if (!sseClients.has(videoJobId)) {
    sseClients.set(videoJobId, []);
  }

  sseClients.get(videoJobId).push(res);

  console.log(`[SSE] Client registered for ${videoJobId} (${sseClients.get(videoJobId).length} total)`);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', videoJobId })}\n\n`);

  // Clean up on close
  res.on('close', () => {
    const clients = sseClients.get(videoJobId) || [];
    const index = clients.indexOf(res);
    if (index > -1) {
      clients.splice(index, 1);
    }
    if (clients.length === 0) {
      sseClients.delete(videoJobId);
    }
    console.log(`[SSE] Client disconnected from ${videoJobId}`);
  });
}

/**
 * Emit SSE event to all connected clients
 */
function emitSSE(videoJobId, event) {
  const clients = sseClients.get(videoJobId) || [];

  console.log(`[SSE] Emitting to ${clients.length} clients for ${videoJobId}: ${event.state}`);

  for (const client of clients) {
    try {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      console.error(`[SSE] Error writing to client:`, error.message);
    }
  }
}

/**
 * Get current video job status
 */
export async function getVideoStatus(videoJobId) {
  const result = await getVideoJobById(videoJobId);

  if (!result) {
    return null;
  }

  return {
    videoJobId,
    sessionId: result.sessionId,
    state: result.videoJob.state,
    videoUrl: result.videoJob.videoUrl,
    error: result.videoJob.error,
    progressEvents: result.videoJob.progressEvents,
  };
}
