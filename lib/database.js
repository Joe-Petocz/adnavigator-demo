/**
 * Simple file-based JSON database for demo sessions
 * For production, replace with PostgreSQL, MongoDB, etc.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DB_DIR, 'sessions.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

// Initialize database file if it doesn't exist
async function initDB() {
  await ensureDataDir();
  try {
    await fs.access(SESSIONS_FILE);
  } catch {
    await fs.writeFile(SESSIONS_FILE, JSON.stringify({}), 'utf-8');
  }
}

// Read all sessions
async function readSessions() {
  await initDB();
  const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
  return JSON.parse(data);
}

// Write all sessions
async function writeSessions(sessions) {
  await ensureDataDir();
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

/**
 * Create a new demo session
 * @param {Object} formData - User intake form data
 * @returns {Object} - New session with ID
 */
export async function createSession(formData) {
  const sessions = await readSessions();

  const sessionId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const session = {
    id: sessionId,
    formData,
    websiteBundle: null,
    analysis_v1: null,
    copy_v1: null,
    video_prompt_v1: null,
    videoJob: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sessions[sessionId] = session;
  await writeSessions(sessions);

  console.log(`[DB] Created session: ${sessionId}`);
  return session;
}

/**
 * Get a session by ID
 * @param {string} sessionId
 * @returns {Object|null} - Session or null if not found
 */
export async function getSession(sessionId) {
  const sessions = await readSessions();
  return sessions[sessionId] || null;
}

/**
 * Update a session
 * @param {string} sessionId
 * @param {Object} updates - Partial session data to merge
 * @returns {Object} - Updated session
 */
export async function updateSession(sessionId, updates) {
  const sessions = await readSessions();

  if (!sessions[sessionId]) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  sessions[sessionId] = {
    ...sessions[sessionId],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeSessions(sessions);

  console.log(`[DB] Updated session: ${sessionId}`, Object.keys(updates));
  return sessions[sessionId];
}

/**
 * Update video job state
 * @param {string} sessionId
 * @param {Object} videoJobUpdate - Video job data
 * @returns {Object} - Updated session
 */
export async function updateVideoJob(sessionId, videoJobUpdate) {
  const session = await getSession(sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const currentVideoJob = session.videoJob || {
    videoJobId: null,
    providerJobId: null,
    state: 'IDLE',
    progressEvents: [],
    videoUrl: null,
    error: null,
  };

  const updatedVideoJob = {
    ...currentVideoJob,
    ...videoJobUpdate,
  };

  // Append progress event if provided
  if (videoJobUpdate.progressEvent) {
    updatedVideoJob.progressEvents = [
      ...(currentVideoJob.progressEvents || []),
      {
        ...videoJobUpdate.progressEvent,
        ts: new Date().toISOString(),
      }
    ];
    delete updatedVideoJob.progressEvent;
  }

  return await updateSession(sessionId, { videoJob: updatedVideoJob });
}

/**
 * Get video job by videoJobId
 * @param {string} videoJobId
 * @returns {Object|null} - Video job with session context
 */
export async function getVideoJobById(videoJobId) {
  const sessions = await readSessions();

  for (const sessionId in sessions) {
    const session = sessions[sessionId];
    if (session.videoJob && session.videoJob.videoJobId === videoJobId) {
      return {
        sessionId,
        videoJob: session.videoJob,
      };
    }
  }

  return null;
}

/**
 * Clean up old sessions (optional housekeeping)
 * @param {number} maxAgeHours - Delete sessions older than this
 */
export async function cleanOldSessions(maxAgeHours = 24) {
  const sessions = await readSessions();
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);

  let cleaned = 0;
  for (const sessionId in sessions) {
    const session = sessions[sessionId];
    const createdAt = new Date(session.createdAt).getTime();

    if (createdAt < cutoff) {
      delete sessions[sessionId];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    await writeSessions(sessions);
    console.log(`[DB] Cleaned ${cleaned} old sessions`);
  }

  return cleaned;
}
