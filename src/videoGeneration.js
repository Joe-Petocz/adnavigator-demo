// OpenAI Sora Video Generation
// NOTE: Sora API is not publicly available yet. This is the structure for when it launches.

/**
 * Generate a UGC testimonial-style video prompt based on business data
 * @param {Object} formData - User's business information from intake form
 * @param {Object} creativeData - AI-generated ad creative (headlines, primaryText, etc.)
 * @param {Object} analysisData - Brand analysis (ICP, positioning, etc.)
 * @returns {string} - Video generation prompt for Sora
 */
export const generateVideoPrompt = (formData, creativeData, analysisData) => {
  const fullName = `${formData?.firstName || 'Sarah'} ${formData?.lastName || 'Johnson'}`.trim();
  const businessName = formData?.website?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') || 'the company';
  const location = formData?.city && formData?.state ? `${formData.city}, ${formData.state}` : 'my area';

  // Extract key benefits from the creative primary text
  const benefits = creativeData?.primaryText || 'amazing results and incredible service';

  // Get the first headline for the hook
  const hook = creativeData?.headlines?.[0] || `${businessName} changed everything for me`;

  // Create a testimonial-style UGC video prompt
  const prompt = `Create a professional UGC testimonial video in vertical 9:16 format.

SCENE: A friendly, authentic person (${analysisData?.icp?.demographics?.[0] || 'professional in their 30s'}) filming themselves with a smartphone in a well-lit, casual home or office setting. Natural lighting, slightly blurred background.

PERSON: Speaking directly to camera with genuine enthusiasm and authenticity. Casual but professional attire. Warm smile, natural gestures.

VIDEO STYLE:
- Natural, handheld smartphone aesthetic (slight movement is okay)
- Bright, inviting atmosphere
- Clean, modern background (bookshelf, plants, or neutral wall)
- Professional but not overly polished - feels like a real customer testimonial

SCRIPT/ACTION (15-30 seconds):
1. Person looks at camera with smile: "${hook}"
2. Gestures while explaining: "I was struggling with [pain point related to ${analysisData?.business?.industry || 'my business'}], but after finding ${businessName}..."
3. Enthusiastic expression: "${benefits.substring(0, 100)}..."
4. Final frame: Person gives thumbs up or nods with confidence
5. Text overlay appears: "${businessName}" with a subtle call-to-action

MOOD: Genuine, trustworthy, relatable, optimistic
PACING: Natural speech rhythm, not rushed
LIGHTING: Soft, flattering natural or ring light
AUDIO: Clear voice, ambient background (subtle)

Make it feel like a real person sharing their genuine experience, not a scripted ad.`;

  return prompt;
};

/**
 * Generate video using OpenAI Sora API (when available)
 * @param {string} prompt - The video generation prompt
 * @returns {Promise<Object>} - Video generation response with URL
 */
export const generateSoraVideo = async (prompt) => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OpenAI API Key not found");
    throw new Error("Missing OpenAI API Key");
  }

  // NOTE: This endpoint doesn't exist yet - placeholder for when Sora API launches
  // Expected endpoint: https://api.openai.com/v1/video/generations
  const SORA_ENDPOINT = "https://api.openai.com/v1/video/generations";

  try {
    console.log("Generating video with Sora AI...");
    console.log("Prompt:", prompt);

    const response = await fetch(SORA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sora-1.0", // Hypothetical model name
        prompt: prompt,
        duration: 8, // seconds
        resolution: "1080x1920", // 9:16 vertical format
        fps: 30,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Sora API Error:", errorData);
      throw new Error(errorData?.error?.message || `Video generation failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log("Video generated successfully:", data);

    return {
      success: true,
      videoUrl: data.url, // Expected response structure
      videoId: data.id,
      status: data.status,
    };

  } catch (error) {
    console.error("Video generation error:", error);

    // Return placeholder response for demo purposes
    return {
      success: false,
      error: error.message,
      message: "Sora API not yet available. Using placeholder video.",
      videoUrl: null, // Would be the actual video URL when API is live
    };
  }
};

/**
 * Poll for video generation status (videos take time to generate)
 * @param {string} videoId - The video generation job ID
 * @returns {Promise<Object>} - Video status and URL when ready
 */
export const checkVideoStatus = async (videoId) => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const STATUS_ENDPOINT = `https://api.openai.com/v1/video/generations/${videoId}`;

  try {
    const response = await fetch(STATUS_ENDPOINT, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    return {
      status: data.status, // "processing", "completed", "failed"
      videoUrl: data.status === "completed" ? data.url : null,
      progress: data.progress, // 0-100
    };
  } catch (error) {
    console.error("Error checking video status:", error);
    throw error;
  }
};

/**
 * Complete flow: Generate prompt and create video
 * @param {Object} formData - Business information
 * @param {Object} creativeData - Ad creative
 * @param {Object} analysisData - Brand analysis
 * @returns {Promise<Object>} - Video result
 */
export const createTestimonialVideo = async (formData, creativeData, analysisData) => {
  console.log("Creating UGC testimonial video...");

  // Step 1: Generate the perfect prompt
  const prompt = generateVideoPrompt(formData, creativeData, analysisData);
  console.log("Generated video prompt:", prompt);

  // Step 2: Call Sora API (when available)
  const result = await generateSoraVideo(prompt);

  // Step 3: If video is processing, poll for completion
  if (result.success && result.status === "processing") {
    console.log("Video is processing... polling for completion");
    // Could implement polling logic here
  }

  return result;
};
