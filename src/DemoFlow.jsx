/**
 * Demo Flow Component - Uses versioned pipeline API
 * Stable, cacheable, with proper error handling and real-time video progress
 */

import { useState, useEffect } from 'react';
import {
  ChevronRight,
  Lock,
  Sparkles,
  ShieldCheck,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

const GOLD_GRADIENT = 'bg-gradient-to-r from-[#FDFBF7] via-[#D4AF37] to-[#AA8220]';
const TEXT_GRADIENT = 'bg-clip-text text-transparent bg-gradient-to-r from-[#FDFBF7] via-[#D4AF37] to-[#AA8220]';

const Button = ({ children, onClick, disabled, variant = 'primary', className = '' }) => {
  const baseStyles = 'px-8 py-4 rounded-xl font-semibold flex items-center gap-2 justify-center transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: `${GOLD_GRADIENT} text-black hover:shadow-2xl hover:shadow-[#D4AF37]/20`,
    outline: 'border-2 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

/**
 * Step 1: Intake Form
 */
export function IntakeStep({ onSubmit }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    website: '',
    city: '',
    state: '',
    radiusMiles: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }

    setFormData({ ...formData, [name]: value });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.website.trim()) newErrors.website = 'Website is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';

    // Validate radiusMiles
    const radius = parseInt(formData.radiusMiles, 10);
    if (!formData.radiusMiles || isNaN(radius)) {
      newErrors.radiusMiles = 'Radius is required';
    } else if (radius <= 0) {
      newErrors.radiusMiles = 'Radius must be greater than 0';
    } else if (radius > 50) {
      newErrors.radiusMiles = 'Radius cannot exceed 50 miles';
    }

    // Validate URL
    if (formData.website.trim()) {
      try {
        const url = formData.website.includes('://') ? formData.website : `https://${formData.website}`;
        new URL(url);
      } catch {
        newErrors.website = 'Invalid website URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // Normalize website URL
      const website = formData.website.includes('://')
        ? formData.website
        : `https://${formData.website}`;

      const payload = {
        ...formData,
        website,
        radiusMiles: parseInt(formData.radiusMiles, 10),
      };

      const response = await fetch('/api/demo/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      onSubmit(data.demoSessionId);
    } catch (error) {
      console.error('Error creating session:', error);
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
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
          Watch our AI scan your website, analyze your competitors, identify your ideal customers, and generate a complete campaign.
        </p>
      </div>

      <div className="w-full max-w-3xl bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#D4AF37]/0 via-[#D4AF37]/10 to-[#D4AF37]/0 blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
        <div className="relative space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <input
                  name="firstName"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                />
                {errors.firstName && <p className="text-red-400 text-sm mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <input
                  name="email"
                  type="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                />
                {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <input
                  name="website"
                  type="url"
                  placeholder="Business Website URL"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                />
                {errors.website && <p className="text-red-400 text-sm mt-1">{errors.website}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    name="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                  />
                  {errors.city && <p className="text-red-400 text-sm mt-1">{errors.city}</p>}
                </div>
                <div>
                  <input
                    name="state"
                    placeholder="State (e.g., CA)"
                    value={formData.state}
                    onChange={handleChange}
                    maxLength="2"
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all uppercase"
                  />
                  {errors.state && <p className="text-red-400 text-sm mt-1">{errors.state}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <input
                  name="lastName"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                />
                {errors.lastName && <p className="text-red-400 text-sm mt-1">{errors.lastName}</p>}
              </div>

              <div>
                <input
                  name="phone"
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                />
                {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone}</p>}
              </div>

              <div>
                <input
                  name="radiusMiles"
                  type="number"
                  placeholder="Target Radius (Miles, max 50)"
                  value={formData.radiusMiles}
                  onChange={handleChange}
                  min="1"
                  max="50"
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37]/50 focus:bg-[#151515] transition-all"
                />
                {errors.radiusMiles && <p className="text-red-400 text-sm mt-1">{errors.radiusMiles}</p>}
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {errors.submit}
              </p>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full text-lg mt-4">
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Creating Session...
              </>
            ) : (
              <>
                See How It Works <ChevronRight size={20} />
              </>
            )}
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
}

/**
 * Step 2: Intelligence Screen (Analysis + Assets)
 */
export function IntelligenceStep({ sessionId, onNext }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const pollSession = async () => {
      try {
        const response = await fetch(`/api/demo/session/${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch session');
        }

        setSession(data);

        // If analysis is ready, stop polling
        if (data.analysis_v1) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    // Poll every 2 seconds until analysis is ready
    const interval = setInterval(pollSession, 2000);
    pollSession(); // Initial fetch

    return () => clearInterval(interval);
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 max-w-md">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Analysis Failed</h2>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !session?.analysis_v1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Loader2 size={64} className="text-[#D4AF37] animate-spin mb-8" />
        <h2 className="text-2xl font-bold text-white mb-4">Analyzing Your Business...</h2>
        <p className="text-neutral-400 text-center max-w-md">
          Scanning your website, identifying your ideal customers, and mapping your competitive landscape.
        </p>
      </div>
    );
  }

  const { analysis_v1 } = session;

  return (
    <div className="max-w-6xl mx-auto py-12 space-y-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Business Intelligence Report
        </h1>
        <p className="text-neutral-400 text-lg">
          Here's what we learned about your business
        </p>
      </div>

      {/* Business Profile */}
      <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <CheckCircle className="text-[#D4AF37]" size={28} />
          Business Profile
        </h2>
        <div className="space-y-4 text-neutral-300">
          <p><strong className="text-white">Name:</strong> {analysis_v1.businessProfile.businessName || 'Not detected'}</p>
          <p><strong className="text-white">Industry:</strong> {analysis_v1.businessProfile.industry}</p>
          <p><strong className="text-white">Description:</strong> {analysis_v1.businessProfile.description}</p>
          <p><strong className="text-white">Positioning:</strong> {analysis_v1.businessProfile.positioning.oneLine}</p>
        </div>
      </div>

      {/* SWOT Analysis */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Strengths</h3>
          <ul className="space-y-2 text-neutral-300">
            {analysis_v1.swot.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Opportunities</h3>
          <ul className="space-y-2 text-neutral-300">
            {analysis_v1.swot.opportunities.map((o, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-400">→</span>
                {o}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Ideal Customer Profiles */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Ideal Customer Profiles</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {analysis_v1.idealCustomerProfiles.slice(0, 3).map((icp, i) => (
            <div key={i} className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">{icp.title}</h3>
              <p className="text-sm text-neutral-400 mb-4">{icp.snapshot}</p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#D4AF37]">Pain Points:</p>
                <ul className="text-xs text-neutral-300 space-y-1">
                  {icp.painPoints.slice(0, 3).map((p, j) => (
                    <li key={j}>• {p}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={onNext} className="mx-auto">
        Generate Ad Copy <ChevronRight size={20} />
      </Button>
    </div>
  );
}

/**
 * Step 3: Copy + CTA + Video Screen
 */
export function CopyAndVideoStep({ sessionId }) {
  const [session, setSession] = useState(null);
  const [copy, setCopy] = useState(null);
  const [videoJobId, setVideoJobId] = useState(null);
  const [videoState, setVideoState] = useState('IDLE');
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoMessage, setVideoMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/demo/session/${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch session');
        }

        setSession(data);
      } catch (err) {
        console.error('Error fetching session:', err);
        setError(err.message);
      }
    };

    fetchSession();
  }, [sessionId]);

  // Generate copy_v1
  useEffect(() => {
    if (!session) return;

    const generateCopy = async () => {
      try {
        const response = await fetch(`/api/demo/session/${sessionId}/copy`, {
          method: 'POST',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate copy');
        }

        setCopy(data);
        setLoading(false);
      } catch (err) {
        console.error('Error generating copy:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (!session.copy_v1) {
      generateCopy();
    } else {
      setCopy(session.copy_v1);
      setLoading(false);
    }
  }, [session, sessionId]);

  // Start video generation
  useEffect(() => {
    if (!copy) return;

    const startVideo = async () => {
      try {
        const response = await fetch(`/api/demo/session/${sessionId}/video/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedHeadline: copy.headlines[0],
            selectedCTA: copy.ctaRecommendations[0]?.cta || 'Get Started',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to start video');
        }

        setVideoJobId(data.videoJobId);
        setVideoState(data.state);
      } catch (err) {
        console.error('Error starting video:', err);
        setVideoState('FAILED');
        setVideoMessage(err.message);
      }
    };

    startVideo();
  }, [copy, sessionId]);

  // Connect to SSE stream for video progress
  useEffect(() => {
    if (!videoJobId) return;

    const eventSource = new EventSource(`/api/demo/video/stream/${videoJobId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('SSE connected:', data.videoJobId);
          return;
        }

        setVideoState(data.state);
        setVideoMessage(data.message);

        if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
        }

        if (data.state === 'COMPLETED' || data.state === 'FAILED') {
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [videoJobId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 max-w-md">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !copy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Loader2 size={64} className="text-[#D4AF37] animate-spin mb-8" />
        <h2 className="text-2xl font-bold text-white mb-4">Generating Ad Copy...</h2>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Your Campaign Creative
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Video Panel */}
        <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Video Ad</h2>

          <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden mb-4 flex items-center justify-center">
            {videoUrl ? (
              <video src={videoUrl} controls className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <Loader2 size={48} className="text-[#D4AF37] animate-spin mx-auto mb-4" />
                <p className="text-white font-semibold">{videoMessage || 'Generating video...'}</p>
                <p className="text-neutral-400 text-sm mt-2">{videoState}</p>
              </div>
            )}
          </div>
        </div>

        {/* Copy Panel */}
        <div className="space-y-6">
          <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Headlines</h3>
            <div className="space-y-3">
              {copy.headlines.map((h, i) => (
                <div key={i} className="bg-[#111] rounded-xl p-4">
                  <p className="text-white font-semibold">{h}</p>
                  <p className="text-neutral-500 text-xs mt-1">{h.length} characters</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Primary Text</h3>
            <p className="text-neutral-300 leading-relaxed">{copy.primaryText}</p>
            <p className="text-neutral-500 text-xs mt-2">{copy.primaryText.length} characters</p>
          </div>

          <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">CTA Recommendations</h3>
            <div className="space-y-2">
              {copy.ctaRecommendations.map((cta, i) => (
                <div key={i} className="bg-[#111] rounded-xl p-4">
                  <p className="text-[#D4AF37] font-semibold">{cta.cta}</p>
                  <p className="text-neutral-400 text-sm mt-1">{cta.why}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
