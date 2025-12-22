import dotenv from 'dotenv';
import express from 'express';

// Load .env.local file
dotenv.config({ path: '.env.local' });
import cors from 'cors';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import demoRoutes from './routes/demoRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// Demo session routes (new versioned pipeline)
app.use('/api/demo', demoRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.VITE_OPENAI_API_KEY
  });
});

// Proxy endpoint for OpenAI Chat Completions
app.post('/api/openai/chat', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      console.error('[ERROR] VITE_OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    console.log('[DEBUG] Proxying OpenAI chat request');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[ERROR] OpenAI API error:', response.status, data);
      return res.status(response.status).json(data);
    }

    console.log('[DEBUG] OpenAI chat request successful');
    res.json(data);
  } catch (error) {
    console.error('[ERROR] Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for Sora video creation
app.post('/api/sora/videos', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      console.error('[ERROR] VITE_OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    console.log('[DEBUG] Proxying Sora video creation request');
    const { model, prompt, seconds, size } = req.body;

    const formData = new FormData();
    formData.append('model', model);
    formData.append('prompt', prompt);
    formData.append('seconds', seconds);
    formData.append('size', size);

    const response = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[ERROR] Sora API error:', response.status, data);
      return res.status(response.status).json(data);
    }

    console.log('[DEBUG] Sora video creation successful:', data.id);
    res.json(data);
  } catch (error) {
    console.error('[ERROR] Sora proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for Sora video status
app.get('/api/sora/videos/:videoId', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    const { videoId } = req.params;

    if (!apiKey) {
      console.error('[ERROR] VITE_OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[ERROR] Sora status check error:', response.status, data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('[ERROR] Sora status proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for Sora video content (the actual video file)
app.get('/api/sora/videos/:videoId/content', async (req, res) => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    const { videoId } = req.params;

    if (!apiKey) {
      console.error('[ERROR] VITE_OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    console.log(`[DEBUG] Fetching video content for: ${videoId}`);

    const response = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ERROR] Sora video content error:', response.status, errorText);
      return res.status(response.status).send(errorText);
    }

    // Stream the video content
    res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Pipe the video stream to the response
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('[ERROR] Sora video content proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[INFO] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[INFO] API key configured: ${!!process.env.VITE_OPENAI_API_KEY}`);
});
