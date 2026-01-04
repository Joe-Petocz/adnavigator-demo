import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Facebook,
  Globe,
  Layers,
  Lock,
  MonitorPlay,
  Play,
  Scan,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Video,
  AlertCircle,
  Loader2,
} from "lucide-react";
import "./index.css";
import { deployAdCampaign } from "./facebookIntegration";

// FEATURE FLAG: Set to false to use placeholder video and skip expensive Sora API calls ($1 per video)
// Set to true when ready to go live with real video generation
const ENABLE_REAL_VIDEO_GENERATION = false;

const GOLD_GRADIENT = "bg-gradient-to-r from-[#FDFBF7] via-[#D4AF37] to-[#AA8220]";
const TEXT_GRADIENT =
  "bg-clip-text text-transparent bg-gradient-to-r from-[#FDFBF7] via-[#D4AF37] to-[#AA8220]";
const GOLD_GLOW = "shadow-[0_0_20px_rgba(212,175,55,0.15)]";

const normalizeUrl = (rawUrl) => {
  if (!rawUrl) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

const fetchWebsiteSnapshot = async (rawUrl) => {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    console.warn("Invalid URL provided for snapshot, returning empty snapshot");
    return {
      url: rawUrl || "",
      title: "",
      description: "",
      text: "",
      headlines: [],
      images: []
    };
  }

  try {
    console.log("Fetching website snapshot for:", normalized);
    const response = await fetch(`https://r.jina.ai/${normalized}`, {
      method: "GET",
      headers: {
        'Accept': 'text/plain'
      }
    });

    if (!response.ok) {
      console.error(`Jina AI fetch failed with status ${response.status}`);
      throw new Error(`Snapshot request failed with status ${response.status}`);
    }

    const payload = await response.text();
    console.log("Successfully fetched website snapshot");
    const [metaBlock = "", markdownBlock = ""] = payload.split("Markdown Content:");

    const titleMatch = metaBlock.match(/Title:\s*(.+)/i);
    const descriptionMatch = metaBlock.match(/Description:\s*(.+)/i);

    const cleanMarkdown = markdownBlock.replace(/\r/g, "").trim();

    const extractHeadlines = () => {
      const headlines = [];
      const headingRegex = /^#{1,3}\s+(.*)$/gm;
      let match;
      // Get up to 10 headlines
      while ((match = headingRegex.exec(cleanMarkdown)) && headlines.length < 10) {
        const text = match[1].trim();
        // Filter out common nav items and single words
        if (text &&
            !headlines.includes(text) &&
            text.length > 5 &&
            text.length < 100 &&
            !text.match(/^(home|about|contact|menu|login|sign|cart|blog|shop)$/i)) {
          headlines.push(text);
        }
      }
      return headlines;
    };

    const extractImages = () => {
      const images = [];
      const seen = new Set();
      const imageRegex = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
      let match;
      // Get up to 8 product images
      while ((match = imageRegex.exec(cleanMarkdown)) && images.length < 8) {
        const url = match[1].split("?")[0];
        // Filter out logos and icons
        if (!seen.has(url) && !url.match(/(icon|logo|favicon|avatar|thumb)/i)) {
          seen.add(url);
          images.push(url);
        }
      }

      // Fallback: look for direct image URLs
      const fallbackRegex = /(https?:\/\/[^\s)]+?\.(?:png|jpe?g|gif|webp))/gi;
      while (images.length < 8 && (match = fallbackRegex.exec(cleanMarkdown))) {
        const url = match[1];
        if (!seen.has(url) && !url.match(/(icon|logo|favicon|avatar)/i)) {
          seen.add(url);
          images.push(url);
        }
      }

      return images;
    };

    // Extract more text for better analysis (5000 chars instead of 2000)
    const textSample = cleanMarkdown
      .replace(/[#>*_\-`]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);

    return {
      url: normalized,
      title: titleMatch?.[1]?.trim() || "",
      description: descriptionMatch?.[1]?.trim() || "",
      text: textSample,
      headlines: extractHeadlines(),
      images: extractImages(),
    };
  } catch (error) {
    console.error("Failed to fetch site snapshot:", error.message);
    // Return minimal snapshot data instead of null
    return {
      url: normalized,
      title: "",
      description: "",
      text: "",
      headlines: [],
      images: []
    };
  }
};

const generateAnalysis = (companyName = "MyBrand.com") => {
  const resolved = companyName?.trim() || "MyBrand.com";
  return {
    business: {
      industry: "E-Commerce / Retail",
      location: "Global / Digital",
      positioning: "Premium D2C Brand",
      segment: "Affluent Millennials",
    },
    swot: {
      strengths: ["High Brand Recall", "Strong Visual Identity", "Direct Supply Chain"],
      weaknesses: ["Limited Organic Reach", "High CPA on FB", "Inventory Flux"],
      opportunities: ["TikTok Shop Expansion", "Influencer Seeding", "UGC Campaigns"],
      threats: ["Rising Ad Costs", "Low-Cost Competitors", "Platform Volatility"],
    },
    icp: {
      demographics: ["25-45 Years Old", "Urban Dwellers", "$75k+ Income"],
      interests: ["Sustainable Living", "Tech Gadgets", "Modern Design"],
      behaviors: ["Frequent Online Shoppers", "iOS Users", "High LTV potential"],
      personas: ["The Trendsetter", "The Conscious Consumer"],
    },
    assets: {
      headlines: [`Experience ${resolved}`, "Redefining Quality", "Shop The Collection"],
      images: [],
    },
  };
};

const generateCreative = (companyName = "MyBrand.com") => {
  const resolved = companyName?.trim() || "MyBrand.com";
  return {
    headlines: [
      `Stop scrolling. ${resolved} is finally here.`,
      "The secret to upgrading your lifestyle.",
      `Why everyone is talking about ${resolved}.`,
    ],
    primaryText: `We scanned the market and found the missing piece. ${resolved} delivers premium quality without the markup. Join thousands of happy customers today. Free shipping on your first order.`,
    ctas: ["Shop Now", "Learn More"],
  };
};

const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_ENDPOINT = "/api/openai/chat"; // Backend proxy endpoint

const ensureArray = (value, fallback) => {
  if (Array.isArray(value) && value.length) {
    // Ensure all items are strings, not objects
    return value.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        // If it's an object, extract the name property or convert to JSON
        return item.name || item.label || JSON.stringify(item);
      }
      return String(item);
    });
  }
  if (typeof value === "string" && value.trim().length) return [value.trim()];
  return fallback;
};

const ensureString = (value, fallback) => {
  if (typeof value === "string" && value.trim().length) return value.trim();
  return fallback;
};

const fetchFromOpenAI = async ({ systemPrompt, userPayload }) => {
  try {
    console.log("[DEBUG] Calling OpenAI API via backend proxy:", OPENAI_ENDPOINT, "Model:", OPENAI_MODEL);
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPayload },
        ],
      }),
    });

    console.log("[DEBUG] OpenAI Response Status:", response.status, response.statusText);

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const errorMessage = errorPayload?.error?.message || `API request failed with status ${response.status}`;
      console.error("OpenAI API Error:", errorMessage, "Full error:", errorPayload);
      throw new Error(errorMessage);
    }

    const completion = await response.json();
    console.log("[DEBUG] OpenAI Response received, has content:", !!completion?.choices?.[0]?.message?.content);
    const content = completion?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("OpenAI response missing content");
      throw new Error("Invalid API response format");
    }

    const parsed = JSON.parse(content);
    console.log("[DEBUG] Successfully parsed OpenAI response");
    return parsed;
  } catch (error) {
    console.error("[ERROR] OpenAI fetch error:", error.message, error);
    throw error;
  }
};

const fetchBrandAnalysis = async (formData, siteSnapshot) => {
  const websiteName = formData?.website || "MyBrand.com";
  const fallback = generateAnalysis(websiteName);

  try {
    const fullName = `${formData?.firstName || ''} ${formData?.lastName || ''}`.trim();
    const location = `${formData?.city || ''}${formData?.city && formData?.state ? ', ' : ''}${formData?.state || ''}`.trim();

    console.log("Starting brand analysis for:", websiteName);

    const payload = JSON.stringify({
      businessOwner: fullName || 'Business Owner',
      companyName: formData?.website || "MyBrand.com",
      location: location || 'Not specified',
      state: formData?.state,
      city: formData?.city,
      phone: formData?.phone,
      email: formData?.email,
      targetRadius: formData?.radius,
      siteData: siteSnapshot
        ? {
            url: siteSnapshot.url,
            title: siteSnapshot.title,
            metaDescription: siteSnapshot.description,
            extractedHeadlines: siteSnapshot.headlines,
            productImages: siteSnapshot.images,
            websiteContent: siteSnapshot.text,
          }
        : null,
    });

    const data = await fetchFromOpenAI({
      systemPrompt:
        "You are an expert performance marketing strategist and brand analyst with 15+ years analyzing businesses for Meta/Facebook advertising campaigns. Your analysis must be data-driven, specific, and actionable for paid social media advertising. Always respond with valid JSON only, shaped exactly like {business:{industry,location,positioning,segment},swot:{strengths[],weaknesses[],opportunities[],threats[]},icp:{demographics[],interests[],behaviors[],personas[]},assets:{headlines[]}}. IMPORTANT: All array values must be simple strings, NOT objects. For personas, use simple string names like 'The Trendsetter' or 'The Conscious Consumer', NOT objects with properties. Base your analysis on the actual website content, metadata, and business information provided. Be specific to THIS business - avoid generic responses.",
      userPayload: `Analyze this business for a Facebook/Meta advertising campaign. Extract insights from their website content and structure. Provide specific, actionable intelligence:\n\n${payload}\n\nImportant:\n- Use the actual website title, description, and content to understand what they sell\n- Identify their specific industry (not just 'E-Commerce')\n- Determine their actual location from city/state provided\n- Create a positioning statement based on their messaging\n- Identify their likely target segment from website tone and offerings\n- SWOT should be specific to THIS business and their market\n- ICP should reflect who would actually buy from them based on their products/services\n- Include 3-5 specific headline variations found on their site`,
    });

    const safeBusiness = {
      industry: ensureString(data.business?.industry, fallback.business.industry),
      location: ensureString(data.business?.location, fallback.business.location),
      positioning: ensureString(data.business?.positioning, fallback.business.positioning),
      segment: ensureString(data.business?.segment, fallback.business.segment),
    };

    const fallbackHeadlines = ensureArray(siteSnapshot?.headlines, fallback.assets.headlines);

    const result = {
      business: safeBusiness,
      swot: {
        strengths: ensureArray(data.swot?.strengths, fallback.swot.strengths),
        weaknesses: ensureArray(data.swot?.weaknesses, fallback.swot.weaknesses),
        opportunities: ensureArray(data.swot?.opportunities, fallback.swot.opportunities),
        threats: ensureArray(data.swot?.threats, fallback.swot.threats),
      },
      icp: {
        demographics: ensureArray(data.icp?.demographics, fallback.icp.demographics),
        interests: ensureArray(data.icp?.interests, fallback.icp.interests),
        behaviors: ensureArray(data.icp?.behaviors, fallback.icp.behaviors),
        personas: ensureArray(data.icp?.personas, fallback.icp.personas),
      },
      assets: {
        headlines: ensureArray(data.assets?.headlines, fallbackHeadlines),
        images: ensureArray(siteSnapshot?.images, fallback.assets.images),
      },
    };
    console.log("Brand analysis successful:", result);
    return result;
  } catch (error) {
    console.error("OpenAI analysis failed, using fallback data.", error);
    console.log("Using fallback analysis data");
    return fallback;
  }
};

const fetchCreativeAssets = async (formData, siteSnapshot) => {
  const websiteName = formData?.website || "MyBrand.com";
  const fallback = generateCreative(websiteName);

  try {
    console.log("Starting creative generation for:", websiteName);
    const fullName = `${formData?.firstName || ''} ${formData?.lastName || ''}`.trim();

    const payload = JSON.stringify({
      businessOwner: fullName,
      companyName: formData?.website || "MyBrand.com",
      targetLocation: `${formData?.city || ''}${formData?.state ? ', ' + formData?.state : ''}`,
      targetRadius: formData?.radius,
      websiteData: siteSnapshot
        ? {
            title: siteSnapshot.title,
            metaDescription: siteSnapshot.description,
            extractedHeadlines: siteSnapshot.headlines,
            productImages: siteSnapshot.images,
            contentSample: siteSnapshot.text,
          }
        : null,
    });

    const data = await fetchFromOpenAI({
      systemPrompt:
        "You are an expert Facebook/Meta advertising copywriter with proven experience creating high-CTR ad creative for direct response campaigns. Always respond with valid JSON only, shaped exactly like {headlines:[],primaryText:string,ctas:[]}. Requirements: Create 3-5 scroll-stopping headlines (max 12 words each, avoid generic phrases), write engaging primary text (60-80 words, focus on benefits and urgency), and provide 2-3 actionable CTAs. Base the creative on the actual business from their website content. Make it specific to THEIR product/service, not generic.",
      userPayload: `Create Facebook ad creative for this business. Use their actual website content, messaging, and value props. Make it specific and compelling:\n\n${payload}\n\nImportant:\n- Headlines must grab attention and be specific to their product/service\n- Primary text should highlight their unique value proposition from the website\n- Include social proof or urgency if evident from their site\n- CTAs should match their business model (e.g., 'Book Now' for services, 'Shop Now' for products)\n- Avoid generic phrases like 'Discover More' or 'Learn More' unless that's truly their CTA`,
    });

    const result = {
      headlines: ensureArray(data.headlines, fallback.headlines),
      primaryText: ensureString(data.primaryText, fallback.primaryText),
      ctas: ensureArray(data.ctas, fallback.ctas),
    };
    console.log("Creative generation successful:", result);
    return result;
  } catch (error) {
    console.error("OpenAI creative generation failed, using fallback data.", error);
    console.log("Using fallback creative data");
    return fallback;
  }
};

const Button = ({ children, onClick, variant = "primary", className = "", ...props }) => {
  const baseStyle =
    "relative overflow-hidden font-bold transition-all duration-500 rounded-lg flex items-center justify-center gap-2 px-8 py-4 transform hover:-translate-y-0.5 active:translate-y-0";
  const variants = {
    primary: `${GOLD_GRADIENT} text-black shadow-[0_10px_30px_-10px_rgba(212,175,55,0.4)] hover:shadow-[0_20px_40px_-10px_rgba(212,175,55,0.6)]`,
    outline:
      "bg-transparent border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]",
    ghost: "bg-white/5 text-white hover:bg-white/10 backdrop-blur-md border border-white/5",
  };

  return (
    <button
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${className} group`}
      {...props}
    >
      {variant === "primary" && (
        <div className="absolute inset-0 bg-white/40 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out skew-x-12" />
      )}
      {children}
    </button>
  );
};

const Card = ({ children, className = "", hoverEffect = true }) => (
  <div
    className={`bg-[#0B0B0B] border border-white/5 rounded-[24px] p-8 ${
      hoverEffect
        ? "hover:border-[#D4AF37]/30 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)] hover:-translate-y-1"
        : ""
    } transition-all duration-500 relative overflow-hidden ${className}`}
  >
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    {children}
  </div>
);

const GoldIcon = ({ icon: Icon, size = 20, className = "" }) => (
  <div className={`p-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 ${className}`}>
    <Icon size={size} className="text-[#D4AF37]" />
  </div>
);

const IntakeStep = ({ formData, setFormData, onNext }) => {
  const handleInputChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const startAnalysis = () => {
    // Make sure we have a website URL, use a real demo site if not provided
    if (!formData.website || !formData.website.trim()) {
      setFormData({ ...formData, website: "example.com" });
    }
    onNext();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-4xl mx-auto animate-fade-up">
      <div className="text-center space-y-6 mb-12">
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight">
          Launch your campaign
          <br />
          <span className={TEXT_GRADIENT}>in under 3 minutes</span>
        </h1>
        <p className="text-neutral-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-light">
          Watch our AI scan your website, analyze your competitors, identify your ideal customers, and generate a complete campaign — headlines, ad creative, and targeting — ready to deploy.
        </p>
      </div>

      <div className="w-full max-w-3xl bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#D4AF37]/0 via-[#D4AF37]/10 to-[#D4AF37]/0 blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
        <div className="relative space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <input
                name="firstName"
                placeholder="First Name"
                className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                onChange={handleInputChange}
              />
              <input
                name="email"
                placeholder="Email Address"
                type="email"
                className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                onChange={handleInputChange}
              />
              <input
                name="website"
                placeholder="Business Website URL"
                type="url"
                className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                onChange={handleInputChange}
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  name="city"
                  placeholder="City"
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                  onChange={handleInputChange}
                />
                <input
                  name="state"
                  placeholder="State"
                  maxLength="2"
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all uppercase"
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="space-y-6">
              <input
                name="lastName"
                placeholder="Last Name"
                className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                onChange={handleInputChange}
              />
              <input
                name="phone"
                placeholder="Phone Number"
                type="tel"
                className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                onChange={handleInputChange}
              />
              <input
                name="radius"
                placeholder="Target Radius (Miles)"
                type="number"
                min="1"
                max="500"
                className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                onChange={handleInputChange}
              />
            </div>
          </div>
          <Button onClick={startAnalysis} className="w-full text-lg mt-4">
            See How It Works <ChevronRight size={20} />
          </Button>
          <div className="flex justify-center gap-8 pt-2 text-xs font-medium text-neutral-500 uppercase tracking-widest">
            <span className="flex items-center gap-2">
              <Lock size={12} /> No card required
            </span>
            <span className="flex items-center gap-2">
              <Sparkles size={12} /> Under 3 min
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck size={12} /> Data never sold
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingStep = ({ formData, onSnapshot, onComplete, onError }) => {
  const [text, setText] = useState("");
  const steps = [
    "Extracting site structure...",
    "Detecting competitors...",
    "Mapping ICP & behaviors...",
    "Reading brand tone...",
    "Preparing marketing blueprint...",
  ];

  useEffect(() => {
    let index = 0;
    let isMounted = true;
    const interval = setInterval(() => {
      setText(steps[index % steps.length]);
      index += 1;
    }, 1500);

    // Maximum timeout of 45 seconds - if analysis takes longer, use fallback
    const maxTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("Analysis timeout - using fallback data");
        clearInterval(interval);
        const websiteUrl = formData?.website || "MyBrand.com";
        onComplete(generateAnalysis(websiteUrl));
      }
    }, 45000);

    const runAnalysis = async () => {
      try {
        // Ensure we have a website URL to analyze
        const websiteUrl = formData?.website?.trim() || "example.com";
        console.log("Starting analysis with URL:", websiteUrl);

        const snapshot = await fetchWebsiteSnapshot(websiteUrl);
        if (isMounted && onSnapshot) {
          onSnapshot(snapshot);
        }

        const results = await fetchBrandAnalysis({ ...formData, website: websiteUrl }, snapshot);
        if (isMounted) {
          clearTimeout(maxTimeout);
          clearInterval(interval);
          console.log("Analysis complete, transitioning to results");
          onComplete(results);
        }
      } catch (error) {
        console.error("Analysis error:", error);
        if (isMounted) {
          clearTimeout(maxTimeout);
          clearInterval(interval);
          // Use fallback data on error
          const websiteUrl = formData?.website || "MyBrand.com";
          console.log("Using fallback data for:", websiteUrl);
          onComplete(generateAnalysis(websiteUrl));
        }
      }
    };

    runAnalysis();

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(maxTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] w-full text-center space-y-12 animate-fade-in relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.08)_0%,transparent_70%)]" />
      <div className="relative w-72 h-72 flex items-center justify-center">
        <div className="absolute inset-0 bg-[#D4AF37]/5 blur-3xl rounded-full animate-pulse" />
        <div className="absolute inset-0 border border-[#D4AF37]/20 rounded-full border-dashed animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-8 border-t-2 border-r-2 border-[#D4AF37]/40 rounded-full animate-[spin_10s_linear_infinite_reverse]" />
        <div className="absolute inset-16 border-b-2 border-l-2 border-[#D4AF37]/60 rounded-full animate-[spin_3s_linear_infinite]" />
        <div className="absolute inset-4 rounded-full overflow-hidden opacity-30">
          <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#D4AF37_360deg)] animate-[spin_4s_linear_infinite]" />
        </div>
        <div className="relative z-10 w-24 h-24 bg-[#0B0B0B] rounded-full border border-[#D4AF37]/30 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.2)]">
          <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-[#D4AF37]" />
          <Scan className="text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]" size={40} />
        </div>
        <div className="absolute inset-0 animate-[spin_8s_linear_infinite]">
          <div className="absolute top-0 left-1/2 w-2 h-2 bg-[#D4AF37] rounded-full blur-[1px] shadow-[0_0_10px_#D4AF37]" />
        </div>
        <div className="absolute inset-12 animate-[spin_12s_linear_infinite_reverse]">
          <div className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-white rounded-full blur-[1px]" />
        </div>
      </div>
      <div className="space-y-4 z-10 relative">
        <h2 className="text-3xl font-bold text-white tracking-tight">
          Hang tight — analyzing <span className={TEXT_GRADIENT}>your brand</span>...
        </h2>
        <div className="flex items-center justify-center gap-3">
          <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          <p className="text-[#D4AF37] font-mono text-sm tracking-[0.2em] uppercase ml-2">{text}</p>
        </div>
      </div>
    </div>
  );
};

const ReportStep = ({ data, onNext }) => (
  <div className="w-full max-w-6xl mx-auto py-12 animate-fade-up pb-32">
    <div className="flex justify-between items-end mb-12 border-b border-white/10 pb-8">
      <div>
        <h2 className="text-4xl font-bold text-white mb-2">Your Brand Intelligence Report.</h2>
        <p className="text-neutral-400">Deep strategic insights generated from your digital footprint.</p>
      </div>
      <Button onClick={onNext} variant="primary">
        Next: Generate Your UGC Ad <ChevronRight size={20} />
      </Button>
    </div>
    <div className="grid grid-cols-12 gap-6">
      <Card className="col-span-12 md:col-span-4 space-y-6">
        <GoldIcon icon={Globe} />
        <h3 className="text-xl font-bold text-white">Business Profile</h3>
        <div className="space-y-4">
          {Object.entries(data.business).map(([key, value]) => (
            <div key={key}>
              <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">{key}</div>
              <div className="text-white font-medium">{value}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="col-span-12 md:col-span-8">
        <div className="flex items-center gap-4 mb-6">
          <GoldIcon icon={Activity} />
          <h3 className="text-xl font-bold text-white">SWOT Analysis</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[#D4AF37] text-sm font-bold mb-3 uppercase">Strengths</div>
            <ul className="space-y-2">
              {data.swot.strengths.map((item) => (
                <li key={item} className="text-neutral-300 text-sm flex gap-2">
                  <div className="w-1 h-1 bg-[#D4AF37] rounded-full mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-red-400 text-sm font-bold mb-3 uppercase">Weaknesses</div>
            <ul className="space-y-2">
              {data.swot.weaknesses.map((item) => (
                <li key={item} className="text-neutral-300 text-sm flex gap-2">
                  <div className="w-1 h-1 bg-red-400 rounded-full mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-green-400 text-sm font-bold mb-3 uppercase">Opportunities</div>
            <ul className="space-y-2">
              {data.swot.opportunities.map((item) => (
                <li key={item} className="text-neutral-300 text-sm flex gap-2">
                  <div className="w-1 h-1 bg-green-400 rounded-full mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-orange-400 text-sm font-bold mb-3 uppercase">Threats</div>
            <ul className="space-y-2">
              {data.swot.threats.map((item) => (
                <li key={item} className="text-neutral-300 text-sm flex gap-2">
                  <div className="w-1 h-1 bg-orange-400 rounded-full mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
      <Card className="col-span-12 md:col-span-6">
        <div className="flex items-center gap-4 mb-6">
          <GoldIcon icon={Target} />
          <h3 className="text-xl font-bold text-white">Ideal Customer Profile</h3>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {data.icp.personas.map((persona) => (
              <span
                key={persona}
                className="px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] rounded-full text-xs font-bold uppercase tracking-wide"
              >
                {persona}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <h4 className="text-white text-sm font-bold mb-2">Demographics</h4>
              {data.icp.demographics.map((item) => (
                <div key={item} className="text-neutral-400 text-sm">
                  {item}
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-white text-sm font-bold mb-2">Interests</h4>
              {data.icp.interests.map((item) => (
                <div key={item} className="text-neutral-400 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <Card className="col-span-12 md:col-span-6">
        <div className="flex items-center gap-4 mb-6">
          <GoldIcon icon={Layers} />
          <h3 className="text-xl font-bold text-white">Detected Assets</h3>
        </div>
        {data.assets.images?.length ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.assets.images.map((src, idx) => (
              <div
                key={`${src}-${idx}`}
                className="w-36 h-28 bg-neutral-900 rounded-lg border border-white/5 overflow-hidden shrink-0"
              >
                <img src={src} alt="Detected brand asset" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-hidden relative">
            <div className="w-32 h-32 bg-neutral-900 rounded-lg border border-white/5 flex items-center justify-center text-neutral-700">
              Logo
            </div>
            <div className="w-48 h-32 bg-neutral-900 rounded-lg border border-white/5 flex items-center justify-center text-neutral-700">
              Hero Img 1
            </div>
            <div className="w-48 h-32 bg-neutral-900 rounded-lg border border-white/5 flex items-center justify-center text-neutral-700">
              Hero Img 2
            </div>
            <div className="absolute right-0 top-0 h-full w-20 bg-gradient-to-l from-[#0B0B0B] to-transparent" />
          </div>
        )}
        <div className="mt-4">
          <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Detected Headline</div>
          <div className="text-white italic">
            {data.assets.headlines?.length ? `"${data.assets.headlines[0]}"` : "No headline detected"}
          </div>
        </div>
      </Card>
    </div>
  </div>
);

const CreativeLoadingStep = ({ formData, snapshot, onComplete }) => {
  const [text, setText] = useState("");
  const steps = [
    "Writing UGC script...",
    "Creating Sora/VEO scenes...",
    "Crafting voice & pacing...",
    "Writing headlines...",
    "Writing primary text...",
  ];

  useEffect(() => {
    let index = 0;
    let isMounted = true;
    const interval = setInterval(() => {
      setText(steps[index % steps.length]);
      index += 1;
    }, 1200);

    // Maximum timeout of 30 seconds for creative generation
    const maxTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("Creative generation timeout - using fallback data");
        clearInterval(interval);
        onComplete(generateCreative(formData?.website));
      }
    }, 30000);

    const runCreative = async () => {
      try {
        const results = await fetchCreativeAssets(formData, snapshot);
        if (isMounted) {
          clearTimeout(maxTimeout);
          clearInterval(interval);
          onComplete(results);
        }
      } catch (error) {
        console.error("Creative generation error:", error);
        if (isMounted) {
          clearTimeout(maxTimeout);
          clearInterval(interval);
          // Use fallback data on error
          onComplete(generateCreative(formData?.website));
        }
      }
    };

    runCreative();

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(maxTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] w-full text-center space-y-8 animate-fade-in">
      <div className="w-64 h-2 bg-neutral-900 rounded-full overflow-hidden relative">
        <div className="absolute inset-0 bg-neutral-800" />
        <div
          className={`absolute top-0 left-0 h-full ${GOLD_GRADIENT} w-1/3 animate-[slideRight_1.5s_ease-in-out_infinite]`}
        />
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      </div>
      <div className="space-y-4">
        <h2 className="text-3xl font-bold text-white">Creating Your AI-Generated Ad Assets...</h2>
        <div className="flex items-center justify-center gap-3 text-[#D4AF37] font-mono text-sm tracking-widest uppercase">
          <Cpu className="animate-pulse" size={16} /> {text}
        </div>
      </div>
    </div>
  );
};

const CreativeRevealStep = ({ data, onNext, formData, videoProgress = null, videoReady = false, videoUrl = null, error = null }) => (
  <div className="w-full max-w-5xl mx-auto py-12 animate-fade-up">
    <div className="text-center mb-12">
      <h2 className="text-4xl font-bold text-white mb-3">Your AI-Generated Creative Is Ready.</h2>
      <p className="text-neutral-400">Review your automated campaign assets below.</p>
    </div>
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12 md:col-span-6">
        <div className="aspect-[9/16] bg-black rounded-[32px] border-[4px] border-[#1a1a1a] shadow-2xl relative overflow-hidden group">
          {videoReady && videoUrl ? (
            // Real video from Sora API
            <div className="relative w-full h-full bg-black">
              <video
                src={videoUrl}
                className="w-full h-full object-cover"
                controls
                autoPlay
                loop
                playsInline
                title="Generated Video"
              />
              <div className="absolute top-4 left-4 right-4 pointer-events-none">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-green-500/30">
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <CheckCircle size={14} />
                    <span>Generated by Sora AI</span>
                  </div>
                </div>
              </div>
            </div>
          ) : videoReady && error === "demo_mode" ? (
            // Demo mode placeholder when API not available
            <div className="relative w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-800 to-black">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="mb-6">
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mx-auto">
                      <Play size={48} className="text-amber-500 ml-1" />
                    </div>
                  </div>
                  <h3 className="text-white text-2xl font-bold mb-3">Video Ready (Demo Mode)</h3>
                  <p className="text-neutral-300 text-sm mb-2">Sora API not yet available</p>
                  <p className="text-neutral-500 text-xs italic">Video would appear here when API launches</p>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>8-second UGC Testimonial</span>
                    <span>9:16 Format</span>
                  </div>
                </div>
              </div>
            </div>
          ) : videoReady && error ? (
            // Error state - Processing Failed
            <div className="relative w-full h-full bg-gradient-to-br from-red-900/20 via-neutral-900 to-black">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="mb-6">
                    <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto">
                      <AlertCircle size={48} className="text-red-500" />
                    </div>
                  </div>
                  <h3 className="text-white text-xl font-bold mb-3">Processing Failed</h3>
                  <p className="text-neutral-400 text-sm max-w-xs mb-4">{error}</p>
                  <p className="text-neutral-500 text-xs italic">Please try again or contact support</p>
                </div>
              </div>
            </div>
          ) : error && !videoReady ? (
            // Error during processing - keep showing processing state with error info
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-black flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-6 relative">
                <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                  <AlertCircle size={40} className="text-red-500" />
                </div>
              </div>
              <h3 className="text-white text-xl font-bold mb-3">Processing Failed</h3>
              <p className="text-neutral-400 text-sm max-w-xs leading-relaxed mb-4">
                {error}
              </p>
              <p className="text-neutral-500 text-xs italic">Unable to generate video</p>
            </div>
          ) : (
            // Video is generating - show progress
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-black flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-6 relative">
                <div className="w-20 h-20 rounded-full bg-[#D4AF37]/10 border-2 border-[#D4AF37]/30 flex items-center justify-center animate-pulse">
                  <Video size={40} className="text-[#D4AF37]" />
                </div>
                <div className="absolute -inset-2 rounded-full border-2 border-[#D4AF37]/20 animate-ping" />
              </div>
              <h3 className="text-white text-xl font-bold mb-3">Video Being Generated</h3>
              <p className="text-neutral-400 text-sm max-w-xs leading-relaxed mb-2">
                Our AI is generating your custom UGC testimonial video.
              </p>
              <p className="text-neutral-500 text-xs max-w-xs leading-relaxed mb-4">
                Due to many agencies testing the platform, this may take up to 3 minutes depending on current demand.
              </p>
              <div className="mt-2 w-48 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#AA8220] transition-all duration-300" style={{ width: `${videoProgress || 0}%` }} />
              </div>
              <p className="text-neutral-500 text-xs mt-4">{videoProgress || 0}% Complete</p>
              <p className="text-neutral-600 text-xs mt-2 italic">AI-Powered Video Generation</p>
            </div>
          )}
        </div>
      </div>
      <div className="col-span-12 md:col-span-6 space-y-6">
        <Card className="space-y-4">
          <h3 className="text-sm text-[#D4AF37] font-bold uppercase tracking-widest">Headline Variations</h3>
          <div className="space-y-3">
            {data.headlines.map((headline, index) => (
              <div
                key={index}
                className="p-4 bg-white/5 rounded-xl border border-white/5 text-white text-sm font-medium hover:border-[#D4AF37]/30 transition-colors cursor-pointer"
              >
                {headline}
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-4">
          <h3 className="text-sm text-[#D4AF37] font-bold uppercase tracking-widest">Primary Text</h3>
          <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-neutral-300 text-sm leading-relaxed">
            {data.primaryText}
          </div>
        </Card>
        <Card className="space-y-4">
          <h3 className="text-sm text-[#D4AF37] font-bold uppercase tracking-widest">CTA Recommendations</h3>
          <div className="flex gap-3">
            {data.ctas.map((cta) => (
              <span
                key={cta}
                className="px-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white text-sm font-medium"
              >
                {cta}
              </span>
            ))}
          </div>
        </Card>
        <div className="flex gap-4 pt-4 flex-col sm:flex-row">
          <Button variant="outline" className="flex-1">
            <Download size={18} /> Download Assets
          </Button>
          <Button variant="primary" onClick={onNext} className="flex-1">
            Next: Deploy Campaign <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  </div>
);

// Wrapper to handle video generation timing
const CreativeRevealStepWrapper = ({ data, onNext, formData, onVideoReady }) => {
  const [progress, setProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let progressInterval;

    const generateVideo = async () => {
      try {
        // FEATURE FLAG: Skip expensive Sora API calls during testing
        if (!ENABLE_REAL_VIDEO_GENERATION) {
          console.log("🎬 Using placeholder video (ENABLE_REAL_VIDEO_GENERATION = false)");

          // Simulate video generation progress
          setProgress(30);
          await new Promise(resolve => setTimeout(resolve, 1000));
          setProgress(60);
          await new Promise(resolve => setTimeout(resolve, 1000));
          setProgress(90);
          await new Promise(resolve => setTimeout(resolve, 500));

          // Use a shorter 1-minute placeholder video URL (instead of 10-minute Big Buck Bunny)
          const placeholderVideoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

          if (isMounted) {
            setProgress(100);
            setVideoUrl(placeholderVideoUrl);
            setVideoReady(true);
            console.log("✅ Placeholder video ready:", placeholderVideoUrl);

            // Notify parent component of video URL
            if (onVideoReady) {
              onVideoReady(placeholderVideoUrl);
            }
          }
          return;
        }

        console.log("Starting Sora video generation...");

        // Generate video prompt from form data
        const businessName = formData?.website?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') || 'the company';
        const hook = data?.headlines?.[0] || "Transform your business";

        const prompt = `Create a professional UGC testimonial video in vertical 9:16 format.

SCENE: A friendly person filming themselves with a smartphone in a well-lit, casual setting.

VIDEO STYLE: Natural, handheld smartphone aesthetic. Bright, inviting. Professional but authentic.

SCRIPT (8 seconds): Person smiles at camera: "${hook}. I found ${businessName} and it changed everything. Highly recommend!"

MOOD: Genuine, trustworthy, relatable`;

        console.log("Video prompt:", prompt);

        // Start with initial progress
        setProgress(10);

        // Call OpenAI Sora API via backend proxy
        console.log("[DEBUG] Calling Sora API via backend proxy: POST /api/sora/videos");
        console.log("[DEBUG] Sora request params:", {
          model: 'sora-2-pro',
          seconds: '8',
          size: '720x1280',
          promptLength: prompt.length
        });

        const response = await fetch("/api/sora/videos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: 'sora-2-pro',
            prompt: prompt,
            seconds: '8',
            size: '720x1280',
          }),
        });

        console.log("[DEBUG] Sora Response Status:", response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error(`[ERROR] Sora API ${response.status} response:`, errorText);
          throw new Error(`Sora API error: ${response.status}`);
        }

        const jobResult = await response.json();
        console.log("Sora job created:", jobResult);

        const videoId = jobResult.id;
        if (!videoId) {
          throw new Error("No video ID in response");
        }

        // Set progress after successful API call
        if (isMounted) {
          setProgress(20);
        }

        // Poll for video completion
        console.log("Polling for video completion...");
        let pollAttempts = 0;
        const maxPolls = 60; // 60 attempts = 5 minutes max

        while (pollAttempts < maxPolls && isMounted) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

          const statusResponse = await fetch(`/api/sora/videos/${videoId}`);

          const statusResult = await statusResponse.json();
          console.log("Video status:", statusResult.status);

          // Update progress based on polling attempts (20% to 95%)
          const progressIncrement = Math.floor(20 + (pollAttempts / maxPolls) * 75);
          if (isMounted) {
            setProgress(Math.min(progressIncrement, 95));
          }

          if (statusResult.status === "completed") {
            // Get the video content URL (proxied through our backend)
            const videoUrl = `/api/sora/videos/${videoId}/content`;

            if (isMounted) {
              setProgress(100);
              setVideoUrl(videoUrl);
              setVideoReady(true);
              console.log("Video ready:", videoUrl);
              // Notify parent component of video URL
              if (onVideoReady) {
                onVideoReady(videoUrl);
              }
            }
            break;
          } else if (statusResult.status === "failed") {
            throw new Error("Video generation failed");
          }

          pollAttempts++;
        }

        if (pollAttempts >= maxPolls) {
          throw new Error("Video generation timeout");
        }

      } catch (err) {
        console.error("Video generation error:", err);

        if (isMounted) {
          // Check if API not available yet (common error codes)
          const errorMsg = err.message || "";
          if (errorMsg.includes("404") || errorMsg.includes("401") || errorMsg.includes("405") || errorMsg.includes("403")) {
            console.warn("Sora API not publicly available yet - using demo mode");
            setProgress(100);
            setVideoReady(true);
            setError("demo_mode");
          } else {
            // For real errors, set error state but keep videoReady false
            // This will keep showing "Video Being Processed" with error indicator
            console.error("Unexpected error:", err);
            setError(err.message);
            setVideoReady(true); // Show error state
          }
        }
      }
    };

    generateVideo();

    return () => {
      isMounted = false;
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [data, formData]);

  return <CreativeRevealStep data={data} formData={formData} onNext={onNext} videoProgress={progress} videoReady={videoReady} videoUrl={videoUrl} error={error} />;
};

const DemoVideoStep = ({ onNext }) => (
  <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-5xl mx-auto text-center space-y-10 animate-fade-up px-4">
    <div className="space-y-4">
      <h2 className="text-4xl md:text-5xl font-bold text-white">See AdNavigator in Action.</h2>
      <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
        Watch how our AI builds, launches, and optimizes campaigns in seconds.
      </p>
    </div>
    <div className="w-full aspect-video bg-black rounded-[32px] border border-white/10 shadow-[0_0_50px_rgba(212,175,55,0.15)] relative overflow-hidden group">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1533750516457-a7f992034fec?q=80&w=2600&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-30 transition-opacity duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full bg-[#D4AF37]/90 backdrop-blur-md flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.4)] cursor-pointer hover:scale-110 transition-transform duration-300 group-hover:shadow-[0_0_60px_rgba(212,175,55,0.6)]">
          <Play size={40} className="text-black fill-black ml-2" />
        </div>
      </div>
      <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
        <div className="text-left">
          <h3 className="text-white font-bold text-xl mb-1">AdNavigator Platform Tour</h3>
          <p className="text-neutral-400 text-sm">02:14 • 4K Quality</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/10 text-xs font-bold uppercase tracking-widest text-white">
            AI Demo
          </div>
        </div>
      </div>
    </div>
    <div className="pt-4">
      <Button onClick={onNext} className="w-full md:w-auto text-lg px-12 py-5 shadow-2xl">
        Ready to launch? View Plans <ArrowRight size={20} className="ml-2" />
      </Button>
    </div>
  </div>
);

const CampaignBuildingStep = ({ adAccountUrl, onComplete }) => {
  const [progress, setProgress] = useState([
    { step: 'Campaign Created', status: 'completed' },
    { step: 'Ad Set Configured', status: 'completed' },
    { step: 'Video Uploaded', status: 'completed' },
    { step: 'Creative Built', status: 'in_progress' },
    { step: 'Ad Published', status: 'pending' },
  ]);

  useEffect(() => {
    // Simulate progress updates
    const timer1 = setTimeout(() => {
      setProgress(prev => prev.map((item, idx) =>
        idx === 3 ? { ...item, status: 'completed' } : item
      ));
    }, 1500);

    const timer2 = setTimeout(() => {
      setProgress(prev => prev.map((item, idx) =>
        idx === 4 ? { ...item, status: 'in_progress' } : item
      ));
    }, 2000);

    const timer3 = setTimeout(() => {
      setProgress(prev => prev.map((item, idx) =>
        idx === 4 ? { ...item, status: 'completed' } : item
      ));
      setTimeout(onComplete, 1000);
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-xl mx-auto text-center space-y-10 animate-fade-up">
      <div className="space-y-4">
        <div className="w-20 h-20 rounded-full bg-[#D4AF37]/10 border-2 border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <Loader2 size={40} className="text-[#D4AF37] animate-spin" />
        </div>
        <h2 className="text-4xl font-bold text-white">Building Your Campaign...</h2>
        <p className="text-neutral-400 text-lg">Deploying to Facebook Ads Manager</p>
      </div>

      <Card className="w-full space-y-4 py-8">
        {progress.map((item, idx) => (
          <div key={idx} className="flex items-center gap-4 px-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              item.status === 'completed'
                ? 'bg-green-500/20 border-2 border-green-500'
                : item.status === 'in_progress'
                ? 'bg-[#D4AF37]/20 border-2 border-[#D4AF37] animate-pulse'
                : 'bg-neutral-800 border-2 border-neutral-700'
            }`}>
              {item.status === 'completed' && <CheckCircle size={16} className="text-green-400" />}
              {item.status === 'in_progress' && <Loader2 size={16} className="text-[#D4AF37] animate-spin" />}
            </div>
            <div className="flex-1 text-left">
              <p className={`font-medium ${
                item.status === 'completed'
                  ? 'text-green-400'
                  : item.status === 'in_progress'
                  ? 'text-[#D4AF37]'
                  : 'text-neutral-500'
              }`}>
                {item.step}
              </p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

const CampaignSuccessStep = ({ adAccountUrl, onNext }) => (
  <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-xl mx-auto text-center space-y-10 animate-fade-up">
    <div className="space-y-6">
      <div className="w-24 h-24 rounded-full bg-green-500/20 border-4 border-green-500/50 flex items-center justify-center mx-auto animate-scale-in">
        <CheckCircle size={48} className="text-green-400" />
      </div>
      <h2 className="text-4xl font-bold text-white">Campaign Successfully Created!</h2>
      <p className="text-neutral-400 text-lg max-w-md mx-auto">
        Your campaign is now live in your Facebook Ads Manager. You can review and activate it anytime.
      </p>
    </div>

    <Card className="w-full space-y-6 py-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between px-6">
          <span className="text-neutral-400">Status</span>
          <span className="text-green-400 font-medium">Paused (Ready to Activate)</span>
        </div>
        <div className="flex items-center justify-between px-6">
          <span className="text-neutral-400">Daily Budget</span>
          <span className="text-white font-medium">$5.00</span>
        </div>
        <div className="flex items-center justify-between px-6">
          <span className="text-neutral-400">Objective</span>
          <span className="text-white font-medium">Lead Generation</span>
        </div>
      </div>

      <div className="px-6 pt-4">
        <Button
          onClick={() => window.open(adAccountUrl || 'https://business.facebook.com/adsmanager', '_blank')}
          className="w-full text-lg bg-[#1877F2] hover:bg-[#166fe5] border-none text-white"
        >
          <Facebook size={20} className="fill-white" /> View in Ads Manager
        </Button>
      </div>

      <div className="px-6">
        <Button onClick={onNext} variant="outline" className="w-full">
          Continue to Pricing
        </Button>
      </div>
    </Card>
  </div>
);

const DeployStep = ({ onNext, onWatchDemo, creativeData, formData, videoUrl }) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState(null);
  const [showBuildingProgress, setShowBuildingProgress] = useState(false);
  const [adAccountUrl, setAdAccountUrl] = useState(null);

  const handleFacebookConnect = async () => {
    console.log('🔵 handleFacebookConnect called');
    setIsDeploying(true);
    setDeploymentResult(null);
    setShowBuildingProgress(true);

    try {
      console.log('🔵 Calling deployAdCampaign...');
      const result = await deployAdCampaign(creativeData, formData, videoUrl);
      console.log('🔵 deployAdCampaign result:', result);
      setDeploymentResult(result);

      if (result.success && result.adAccountId) {
        setAdAccountUrl(`https://business.facebook.com/adsmanager/manage/campaigns?act=${result.adAccountId}`);
      }
    } catch (error) {
      console.error('🔴 Error in handleFacebookConnect:', error);
      setDeploymentResult({
        success: false,
        error: error.message || 'Failed to connect to Facebook'
      });
      setShowBuildingProgress(false);
    } finally {
      console.log('🔵 Setting isDeploying to false');
      setIsDeploying(false);
    }
  };

  // Show building progress screen when deployment starts
  if (showBuildingProgress && !deploymentResult) {
    return <CampaignBuildingStep adAccountUrl={adAccountUrl} onComplete={() => {}} />;
  }

  // Show success screen when deployment completes successfully
  if (deploymentResult?.success) {
    return <CampaignSuccessStep adAccountUrl={adAccountUrl} onNext={onNext} />;
  }

  // Show connect button and error state
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-xl mx-auto text-center space-y-10 animate-fade-up">
      <div className="space-y-4">
        <h2 className="text-4xl font-bold text-white">One-click deployment.</h2>
        <p className="text-neutral-400 text-lg">Push this campaign directly to your Meta Ads Manager.</p>
      </div>
      <Card className="w-full space-y-8 py-10">
        <Button
          onClick={handleFacebookConnect}
          disabled={isDeploying}
          className="w-full text-lg shadow-blue-900/20 hover:shadow-blue-500/20 bg-[#1877F2] hover:bg-[#166fe5] border-none text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeploying ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Connecting...
            </>
          ) : (
            <>
              <Facebook size={20} className="fill-white" /> Connect Facebook
            </>
          )}
        </Button>

        {deploymentResult && !deploymentResult.success && (
          <div className="p-4 rounded-xl border bg-red-900/20 border-red-500/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertCircle size={20} className="text-red-400" />
              <p className="font-semibold text-red-400">Error</p>
            </div>
            <p className="text-sm text-neutral-300">
              {deploymentResult.error}
            </p>
          </div>
        )}

        <div className="space-y-3 bg-neutral-900/50 p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-center gap-2 text-neutral-400 text-xs uppercase tracking-widest font-bold">
            <Lock size={12} /> Data Privacy Guarantee
          </div>
          <p className="text-neutral-500 text-xs leading-relaxed max-w-sm mx-auto">
            Your advertising data is never used, stored, or sold. You maintain 100% control and can disconnect at any time.
          </p>
        </div>
      </Card>
      <button
        onClick={onWatchDemo}
        className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors group"
      >
        <MonitorPlay size={16} />
        <span className="border-b border-transparent group-hover:border-white transition-all">
          Not ready to connect? Watch a live demo.
        </span>
      </button>
    </div>
  );
};

const PricingStep = ({ onSelect }) => (
  <div className="w-full max-w-6xl mx-auto py-12 animate-fade-up">
    <div className="text-center mb-16 space-y-4">
      <h2 className="text-4xl md:text-5xl font-bold text-white">
        Your AI-powered account is ready.
        <br />
        Activate your workspace.
      </h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      <div className="relative group cursor-pointer" onClick={() => onSelect("startup")}>
        <div className="absolute -inset-[1px] bg-gradient-to-b from-white/10 to-transparent rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <Card className="h-full border-white/10 group-hover:border-[#D4AF37]/50" hoverEffect={false}>
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">Startup</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">$97</span>
              <span className="text-neutral-500">/mo</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8">
            {[
              "10 UGC videos per month",
              "Up to 5 client profiles",
              "Up to 5 ad accounts",
              "Full strategies + ICP",
              "Auto-campaign builds",
              "7-day money-back guarantee",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-neutral-300 text-sm">
                <CheckCircle size={16} className="text-[#D4AF37]" /> {feature}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full">
            Select Startup
          </Button>
        </Card>
      </div>
      <div className="relative group cursor-pointer" onClick={() => onSelect("agency")}>
        <div className="absolute -inset-[2px] rounded-[26px] bg-gradient-to-b from-[#D4AF37] to-[#AA8220] opacity-50 group-hover:opacity-100 blur-sm transition-opacity duration-500" />
        <Card className="h-full bg-[#0F0F0F] relative z-10" hoverEffect={false}>
          <div className="absolute top-0 right-0 bg-[#D4AF37] text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-[22px] tracking-widest uppercase">
            Recommended
          </div>
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              Agency <Star size={16} className="fill-[#D4AF37] text-[#D4AF37]" />
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-[#D4AF37]">$297</span>
              <span className="text-neutral-500">/mo</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8">
            {[
              "30 UGC videos per month",
              "Unlimited client profiles",
              "Unlimited FB connections",
              "Competitor Ad Spy",
              "Deep Meta API sync",
              "Priority support",
              "7-day money-back guarantee",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-white text-sm">
                <div className="p-1 rounded-full bg-[#D4AF37]/20">
                  <CheckCircle size={14} className="text-[#D4AF37]" />
                </div>
                {feature}
              </li>
            ))}
          </ul>
          <Button variant="primary" className="w-full shadow-lg shadow-[#D4AF37]/20">
            Select Agency
          </Button>
        </Card>
      </div>
    </div>
  </div>
);

export default function App() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [analysisData, setAnalysisData] = useState(null);
  const [creativeData, setCreativeData] = useState(null);
  const [siteSnapshot, setSiteSnapshot] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  const handleAnalysisComplete = (data) => {
    console.log("handleAnalysisComplete called, advancing to step 3");
    const finalData = data || generateAnalysis(formData?.website);
    console.log("Analysis data:", finalData);

    // Use flushSync to ensure state updates are applied synchronously
    flushSync(() => {
      setAnalysisData(finalData);
    });

    flushSync(() => {
      console.log("Step transition to 3 executing");
      setStep(3);
    });
  };

  const handleCreativeComplete = (data) => {
    console.log("handleCreativeComplete called, advancing to step 5");
    const finalData = data || generateCreative(formData?.website);
    console.log("Creative data:", finalData);

    // Use flushSync to ensure state updates are applied synchronously
    flushSync(() => {
      setCreativeData(finalData);
    });

    flushSync(() => {
      console.log("Step transition to 5 executing");
      setStep(5);
    });
  };

  useEffect(() => {
    if (analysisData && step < 3) {
      setStep(3);
    }
  }, [analysisData, step]);

  useEffect(() => {
    if (creativeData && step < 5) {
      setStep(5);
    }
  }, [creativeData, step]);

  const startAnalysis = () => {
    setSiteSnapshot(null);
    setAnalysisData(null);
    setCreativeData(null);
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-[#000000] font-sans text-white overflow-x-hidden selection:bg-[#D4AF37]/30 relative">
      <div className="fixed top-0 left-0 w-full h-1.5 bg-neutral-900 z-50">
        <div
          className={`h-full ${GOLD_GRADIENT} shadow-[0_0_15px_rgba(212,175,55,0.5)] transition-all duration-700 ease-in-out`}
          style={{ width: `${Math.min((step / 7) * 100, 100)}%` }}
        />
      </div>
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150" />
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#AA8220]/5 rounded-full blur-[100px]" />
      </div>
      <div className="relative z-10 p-6 md:p-12">
        <header className="flex justify-between items-center max-w-7xl mx-auto mb-16">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${GOLD_GRADIENT} flex items-center justify-center ${GOLD_GLOW}`}>
              <span className="text-black font-bold text-xl">A</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-white hidden md:block">AdNavigator</span>
          </div>
          {step > 1 && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStep((prev) => (Math.floor(prev) === 6 && prev !== 6 ? 6 : Math.max(1, Math.floor(prev - 1))))}
                className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm font-medium"
              >
                <ChevronLeft size={16} /> Back
              </button>
              {step < 7 && (
                <div className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest border border-white/10 px-3 py-1 rounded-full">
                  Demo Sequence // Step 0{Math.floor(step)}
                </div>
              )}
            </div>
          )}
          {step === 1 && step < 7 && (
            <div className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest border border-white/10 px-3 py-1 rounded-full">
              Demo Sequence // Step 0{step}
            </div>
          )}
        </header>
        <main className="max-w-7xl mx-auto">
          {step === 1 && <IntakeStep formData={formData} setFormData={setFormData} onNext={startAnalysis} />}
          {step === 2 && (
            <LoadingStep
              formData={formData}
              onSnapshot={setSiteSnapshot}
              onComplete={handleAnalysisComplete}
            />
          )}
          {step === 3 && analysisData && <ReportStep data={analysisData} onNext={() => setStep(4)} />}
          {step === 4 && (
            <CreativeLoadingStep
              formData={formData}
              snapshot={siteSnapshot}
              onComplete={handleCreativeComplete}
            />
          )}
          {step === 5 && creativeData && <CreativeRevealStepWrapper data={creativeData} formData={formData} onNext={() => setStep(6)} onVideoReady={setVideoUrl} />}
          {step === 6 && (
            <DeployStep
              onNext={() => setStep(7)}
              onWatchDemo={() => setStep(6.1)}
              creativeData={creativeData}
              formData={formData}
              videoUrl={videoUrl}
            />
          )}
          {step === 6.1 && <DemoVideoStep onNext={() => setStep(7)} />}
          {step === 7 && <PricingStep onSelect={() => alert("Redirecting to Stripe...")} />}
        </main>
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes slideRight {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
