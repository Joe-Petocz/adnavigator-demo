/**
 * Centralized prompt definitions with strict JSON schemas
 * Version-controlled prompts for stable, cacheable outputs
 */

/**
 * ANALYSIS_V1: Business Intelligence Analyzer
 *
 * Analyzes business from form data and website bundle
 * Returns: Business profile, SWOT, ICP cards, website assets
 */
export const ANALYSIS_V1_SYSTEM = `You are a business intelligence engine for a marketing automation platform.
You must output VALID JSON only (no markdown, no commentary).
Follow the provided output schema exactly.
If data is missing, use null or empty arrays.
Never invent addresses, awards, or guarantees.
Prefer direct evidence from the website bundle. If uncertain, include assumptions with a confidence score (0 to 1).`;

export function buildAnalysisV1Prompt(formData, websiteBundle) {
  return {
    task: 'ANALYZE_BUSINESS',
    input: {
      form: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        website: formData.website,
        radiusMiles: formData.radiusMiles,
        city: formData.city,
        state: formData.state,
      },
      websiteBundle: websiteBundle,
    },
    output_schema: {
      businessProfile: {
        businessName: 'string|null',
        industry: 'string',
        subIndustries: ['string'],
        serviceArea: {
          city: 'string',
          state: 'string',
          radiusMiles: 'number',
        },
        description: 'string',
        positioning: {
          oneLine: 'string',
          whoWeHelp: 'string',
          coreOffer: 'string',
          differentiators: ['string'],
          proofPoints: ['string'],
        },
        segments: [
          {
            name: 'string',
            whyTheyBuy: 'string',
            topServices: ['string'],
          },
        ],
      },
      swot: {
        strengths: ['string'],
        weaknesses: ['string'],
        opportunities: ['string'],
        threats: ['string'],
      },
      idealCustomerProfiles: [
        {
          title: 'string',
          snapshot: 'string',
          painPoints: ['string'],
          desiredOutcomes: ['string'],
          commonObjections: ['string'],
          bestAngles: ['string'],
        },
      ],
      websiteAssets: {
        logos: ['string'],
        heroImages: ['string'],
        galleryImages: ['string'],
        socialLinks: ['string'],
        notes: ['string'],
      },
      assumptions: [
        {
          text: 'string',
          confidence: 'number',
        },
      ],
      confidence: {
        industry: 'number',
        positioning: 'number',
        segments: 'number',
        icps: 'number',
      },
    },
  };
}

/**
 * COPY_V1: Ad Copy Generator
 *
 * Generates headlines, primary text, and CTA recommendations
 * Requires: analysis_v1 output
 */
export const COPY_V1_SYSTEM = `You are a direct-response ad copywriter for local service businesses.
Output VALID JSON only. No markdown.
Constraints:
- Headlines: <= 40 characters each (hard cap)
- Primary text: 280–450 characters
- No profanity
- No unverifiable claims ("#1", "best", "guaranteed") unless supported by proofPoints
- Use city/state naturally once
- Keep tone: confident, clear, not cheesy`;

export function buildCopyV1Prompt(analysis_v1) {
  return {
    task: 'GENERATE_AD_COPY',
    input: {
      analysis_v1: analysis_v1,
      goal: 'lead_generation',
      tone: 'confident, clear, not cheesy',
    },
    output_schema: {
      headlines: ['string', 'string', 'string'],
      primaryText: 'string',
      ctaRecommendations: [
        {
          cta: 'string',
          why: 'string',
        },
      ],
      creativeNotes: ['string'],
    },
  };
}

/**
 * VIDEO_PROMPT_V1: Video Creative Director
 *
 * Generates SORA2-compatible video prompt and shot plan
 * Requires: analysis_v1, copy_v1, selected headline + CTA
 */
export const VIDEO_PROMPT_V1_SYSTEM = `You are a video creative director generating a short UGC-style ad concept.
Output VALID JSON only. No markdown.
Length target: 8–12 seconds.
Avoid impossible visuals. Avoid false claims.
Use the selected headline + CTA as on-screen text.
If no usable images exist, design text-only scenes.`;

export function buildVideoPromptV1Prompt(analysis_v1, copy_v1, selected, assetsToUse) {
  return {
    task: 'BUILD_VIDEO_PROMPT',
    input: {
      analysis_v1: analysis_v1,
      copy_v1: copy_v1,
      selected: {
        headline: selected.headline,
        cta: selected.cta,
      },
      assetsToUse: {
        logoUrl: assetsToUse.logoUrl || null,
        imageUrls: assetsToUse.imageUrls || [],
      },
      style: 'UGC testimonial + quick service b-roll',
      brandLook: 'clean, premium, high-trust',
    },
    output_schema: {
      videoPrompt: 'string',
      shotPlan: [
        {
          time: 'string',
          visual: 'string',
          onScreenText: 'string',
          notes: 'string',
        },
      ],
      negativePrompt: ['string'],
      renderParams: {
        durationSeconds: 'number',
        aspectRatio: 'string',
      },
    },
  };
}

/**
 * Call OpenAI with retry logic for invalid JSON
 * @param {string} systemPrompt - System instructions
 * @param {Object} userPrompt - User prompt (will be stringified)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function callOpenAIWithSchema(systemPrompt, userPrompt, apiKey) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: JSON.stringify(userPrompt, null, 2),
            },
          ],
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse and validate JSON
      const parsed = JSON.parse(content);

      console.log(`[LLM] Successfully parsed JSON on attempt ${attempt}`);
      return parsed;
    } catch (error) {
      console.error(`[LLM] Attempt ${attempt} failed:`, error.message);

      if (attempt === maxAttempts) {
        // Last attempt failed, throw error
        throw new Error(`Failed to get valid JSON after ${maxAttempts} attempts: ${error.message}`);
      }

      // Retry with repair prompt
      if (attempt === 1) {
        systemPrompt += '\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY valid JSON with no markdown code blocks or extra text.';
      }
    }
  }
}

/**
 * Validate analysis_v1 output structure
 */
export function validateAnalysisV1(data) {
  if (!data.businessProfile) throw new Error('Missing businessProfile');
  if (!data.swot) throw new Error('Missing swot');
  if (!data.idealCustomerProfiles || !Array.isArray(data.idealCustomerProfiles)) {
    throw new Error('Missing or invalid idealCustomerProfiles');
  }
  if (!data.websiteAssets) throw new Error('Missing websiteAssets');
  return true;
}

/**
 * Validate copy_v1 output structure
 */
export function validateCopyV1(data) {
  if (!data.headlines || !Array.isArray(data.headlines) || data.headlines.length !== 3) {
    throw new Error('Invalid headlines - must be array of 3 strings');
  }
  if (!data.primaryText || typeof data.primaryText !== 'string') {
    throw new Error('Invalid primaryText');
  }
  if (!data.ctaRecommendations || !Array.isArray(data.ctaRecommendations)) {
    throw new Error('Invalid ctaRecommendations');
  }

  // Validate headline length
  for (const headline of data.headlines) {
    if (headline.length > 40) {
      throw new Error(`Headline exceeds 40 chars: "${headline}" (${headline.length})`);
    }
  }

  // Validate primary text length
  if (data.primaryText.length < 280 || data.primaryText.length > 450) {
    throw new Error(`Primary text must be 280-450 chars, got ${data.primaryText.length}`);
  }

  return true;
}

/**
 * Validate video_prompt_v1 output structure
 */
export function validateVideoPromptV1(data) {
  if (!data.videoPrompt || typeof data.videoPrompt !== 'string') {
    throw new Error('Invalid videoPrompt');
  }
  if (!data.shotPlan || !Array.isArray(data.shotPlan)) {
    throw new Error('Invalid shotPlan');
  }
  if (!data.renderParams || !data.renderParams.durationSeconds) {
    throw new Error('Invalid renderParams');
  }
  return true;
}
