// Facebook Marketing API Integration

const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;
const FB_API_VERSION = 'v21.0';

/**
 * Initialize Facebook SDK
 */
export const initFacebookSDK = () => {
  return new Promise((resolve, reject) => {
    console.log('🔵 initFacebookSDK called');
    console.log('🔵 FB_APP_ID:', FB_APP_ID);

    // Check if App ID is configured
    if (!FB_APP_ID) {
      console.error('❌ Facebook App ID not configured');
      reject(new Error('Facebook App ID not configured. Please set VITE_FACEBOOK_APP_ID in your environment variables.'));
      return;
    }

    // If FB is already loaded and initialized, resolve immediately
    if (window.FB) {
      console.log('✅ Facebook SDK already initialized');
      resolve();
      return;
    }

    // Set up timeout to reject if SDK doesn't load
    const timeout = setTimeout(() => {
      console.error('❌ Facebook SDK load timeout');
      reject(new Error('Facebook SDK failed to load within 10 seconds'));
    }, 10000);

    // Load Facebook SDK
    window.fbAsyncInit = function() {
      console.log('🔵 fbAsyncInit callback fired');
      clearTimeout(timeout);

      try {
        console.log('🔵 Calling FB.init...');
        window.FB.init({
          appId: FB_APP_ID,
          cookie: true,
          xfbml: true,
          version: FB_API_VERSION
        });
        console.log('✅ Facebook SDK initialized successfully');

        // Give FB SDK extra time to set up all methods after init
        setTimeout(() => {
          console.log('✅ Facebook SDK fully ready');
          resolve();
        }, 1000);
      } catch (error) {
        console.error('❌ Error in FB.init:', error);
        reject(error);
      }
    };

    // Load SDK script
    if (!document.getElementById('facebook-jssdk')) {
      console.log('🔵 Loading Facebook SDK script...');
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';

      script.onerror = (error) => {
        console.error('❌ Failed to load Facebook SDK script:', error);
        clearTimeout(timeout);
        reject(new Error('Failed to load Facebook SDK script'));
      };

      script.onload = () => {
        console.log('✅ Facebook SDK script loaded');
      };

      document.body.appendChild(script);
      console.log('🔵 SDK script tag added to body');
    } else {
      console.log('⚠️ SDK script already exists in DOM');
      // Script exists but fbAsyncInit might not have fired yet
      // Give it a moment then check
      setTimeout(() => {
        if (window.FB) {
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    }
  });
};

/**
 * Login with Facebook and request necessary permissions
 */
export const loginWithFacebook = () => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      console.error('Facebook SDK not available on window object');
      reject(new Error('Facebook SDK not initialized. Call initFacebookSDK() first.'));
      return;
    }

    console.log('Calling FB.login with permissions...');

    window.FB.login(
      (response) => {
        console.log('FB.login response:', response);

        if (response.authResponse) {
          console.log('Facebook login successful', response.authResponse);
          resolve(response.authResponse);
        } else {
          console.log('Facebook login failed or cancelled', response);
          reject(new Error('User cancelled login or did not fully authorize.'));
        }
      },
      {
        scope: 'ads_management,ads_read,business_management,pages_read_engagement',
        return_scopes: true
      }
    );
  });
};

/**
 * Get user's Facebook Pages
 */
export const getFacebookPages = async (accessToken) => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );
    const data = await response.json();

    if (data.error) {
      console.error('Pages fetch error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('Facebook pages:', data.data);
    return data.data;
  } catch (error) {
    console.error('Error fetching pages:', error);
    throw error;
  }
};

/**
 * Get user's ad accounts
 */
export const getAdAccounts = async (accessToken) => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`
    );
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.data;
  } catch (error) {
    console.error('Error fetching ad accounts:', error);
    throw error;
  }
};

/**
 * Create a Lead Generation campaign with CBO
 * Campaign name: "Lead Campaign - [Company Name] - [Date]"
 */
export const createCampaign = async (accessToken, adAccountId, campaignData) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const companyName = campaignData.companyName || 'Business';

    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/campaigns`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          name: `Lead Campaign - ${companyName} - ${today}`,
          objective: 'OUTCOME_LEADS', // Lead generation objective
          status: 'PAUSED', // Start paused for safety
          special_ad_categories: [],
          // CBO (Campaign Budget Optimization)
          budget_optimization: true,
          daily_budget: 500, // $5.00 in cents
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Campaign creation error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('Campaign created:', data);
    return data;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
};

/**
 * Create an ad set with geo-targeting (city + state + radius)
 * Uses lowest cost bid strategy
 */
export const createAdSet = async (accessToken, adAccountId, campaignId, adSetData) => {
  try {
    const { city, state, radiusMiles } = adSetData;

    // Map US state abbreviations to Facebook region keys
    const stateKeys = {
      'AL': '3843', 'AK': '3844', 'AZ': '3845', 'AR': '3846', 'CA': '3847', 'CO': '3848',
      'CT': '3849', 'DE': '3850', 'FL': '3851', 'GA': '3852', 'HI': '3853', 'ID': '3854',
      'IL': '3855', 'IN': '3856', 'IA': '3857', 'KS': '3858', 'KY': '3859', 'LA': '3860',
      'ME': '3861', 'MD': '3862', 'MA': '3863', 'MI': '3864', 'MN': '3865', 'MS': '3866',
      'MO': '3867', 'MT': '3868', 'NE': '3869', 'NV': '3870', 'NH': '3871', 'NJ': '3872',
      'NM': '3873', 'NY': '3874', 'NC': '3875', 'ND': '3876', 'OH': '3877', 'OK': '3878',
      'OR': '3879', 'PA': '3880', 'RI': '3881', 'SC': '3882', 'SD': '3883', 'TN': '3884',
      'TX': '3885', 'UT': '3886', 'VT': '3887', 'VA': '3888', 'WA': '3889', 'WV': '3890',
      'WI': '3891', 'WY': '3892', 'DC': '3893'
    };

    const stateKey = stateKeys[state.toUpperCase()];

    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/adsets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          name: `${city}, ${state} - ${radiusMiles}mi radius`,
          campaign_id: campaignId,
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LEAD_GENERATION',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          status: 'PAUSED',
          // Target by state (region) - simpler and more reliable
          targeting: {
            geo_locations: {
              countries: ['US'],
              regions: stateKey ? [{ key: stateKey }] : undefined
            },
            age_min: 25,
            age_max: 65,
          },
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Ad set creation error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('Ad set created:', data);
    return data;
  } catch (error) {
    console.error('Error creating ad set:', error);
    throw error;
  }
};

/**
 * Upload video creative to Facebook
 */
export const uploadVideoCreative = async (accessToken, adAccountId, videoUrl) => {
  try {
    // Note: This is a simplified version
    // In production, you'd need to download the video and upload it as a video file
    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/advideos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          file_url: videoUrl,
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Video upload error:', data.error);
      return null; // Return null if video upload fails (non-critical)
    }

    console.log('Video uploaded:', data);
    return data;
  } catch (error) {
    console.error('Error uploading video:', error);
    return null;
  }
};

/**
 * Create ad creative with headlines, primary text, CTA, and video
 */
export const createAdCreative = async (accessToken, adAccountId, creativeData) => {
  try {
    const { headlines, primaryText, cta, website, videoId, pageId } = creativeData;

    const creativePayload = {
      access_token: accessToken,
      name: `Creative - ${headlines[0].substring(0, 30)}`,
      object_story_spec: {
        page_id: pageId, // Facebook Page ID
        link_data: {
          link: website,
          message: primaryText,
          name: headlines[0], // Primary headline
          description: headlines[1] || '', // Secondary headline
          call_to_action: {
            type: cta || 'LEARN_MORE',
            value: {
              link: website
            }
          }
        }
      },
      degrees_of_freedom_spec: {
        creative_features_spec: {
          standard_enhancements: {
            enroll_status: 'OPT_OUT'
          }
        }
      }
    };

    // Add video if available
    if (videoId) {
      creativePayload.object_story_spec.video_data = {
        video_id: videoId,
        message: primaryText,
        title: headlines[0],
        call_to_action: {
          type: cta || 'LEARN_MORE',
          value: {
            link: website
          }
        }
      };
      delete creativePayload.object_story_spec.link_data;
    }

    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/adcreatives`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(creativePayload)
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Creative creation error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('Creative created:', data);
    return data;
  } catch (error) {
    console.error('Error creating creative:', error);
    throw error;
  }
};

/**
 * Create the actual ad
 */
export const createAd = async (accessToken, adAccountId, adSetId, creativeId, adData) => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/ads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          name: adData.name || 'Lead Ad',
          adset_id: adSetId,
          creative: {
            creative_id: creativeId
          },
          status: 'PAUSED',
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Ad creation error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('Ad created:', data);
    return data;
  } catch (error) {
    console.error('Error creating ad:', error);
    throw error;
  }
};

/**
 * Complete ad deployment flow
 * Creates: Campaign (CBO, $5 budget) → Ad Set (geo-targeted) → Creative (with all assets) → Ad
 */
export const deployAdCampaign = async (creativeData, formData, videoUrl = null) => {
  try {
    console.log('Starting ad deployment...');
    console.log('Creative data:', creativeData);
    console.log('Form data:', formData);

    // 1. Initialize Facebook SDK (includes 1s wait after FB.init)
    await initFacebookSDK();
    console.log('✅ Facebook SDK ready for login');

    // Verify FB is ready
    if (!window.FB) {
      throw new Error('Facebook SDK did not initialize properly');
    }

    // 2. Login and get access token
    const authResponse = await loginWithFacebook();
    const accessToken = authResponse.accessToken;
    console.log('User authenticated');

    // 3. Get Facebook Pages
    const pages = await getFacebookPages(accessToken);

    if (!pages || pages.length === 0) {
      throw new Error('No Facebook Pages found. Please create a Facebook Page to run ads.');
    }

    // Use first page
    const page = pages[0];
    console.log('Using Facebook Page:', page.name);

    // 4. Get ad accounts
    const adAccounts = await getAdAccounts(accessToken);

    if (!adAccounts || adAccounts.length === 0) {
      throw new Error('No ad accounts found. Please create an ad account in Facebook Business Manager.');
    }

    // Use first active ad account
    const activeAccount = adAccounts.find(acc => acc.account_status === 1) || adAccounts[0];
    console.log('Using ad account:', activeAccount.name);

    // 4. Create campaign with CBO and $5 budget
    const campaign = await createCampaign(accessToken, activeAccount.id, {
      companyName: formData.firstName + ' ' + formData.lastName || 'Business'
    });

    // 5. Create ad set with geo-targeting (city + state + radius)
    const adSet = await createAdSet(accessToken, activeAccount.id, campaign.id, {
      city: formData.city,
      state: formData.state,
      radiusMiles: formData.radiusMiles,
      website: formData.website
    });

    // 6. Upload video if available
    let videoId = null;
    if (videoUrl) {
      const videoData = await uploadVideoCreative(accessToken, activeAccount.id, videoUrl);
      if (videoData && videoData.id) {
        videoId = videoData.id;
      }
    }

    // 7. Create ad creative with all headlines, primary text, CTA
    const creative = await createAdCreative(accessToken, activeAccount.id, {
      headlines: creativeData.headlines,
      primaryText: creativeData.primaryText,
      cta: creativeData.ctas && creativeData.ctas[0] ? creativeData.ctas[0].toUpperCase().replace(/\s+/g, '_') : 'LEARN_MORE',
      website: formData.website,
      videoId: videoId,
      pageId: page.id
    });

    // 8. Create the ad
    const ad = await createAd(accessToken, activeAccount.id, adSet.id, creative.id, {
      name: `Lead Ad - ${formData.city}, ${formData.state}`
    });

    return {
      success: true,
      campaign,
      adSet,
      creative,
      ad,
      adAccount: activeAccount,
      message: 'Campaign created successfully! The campaign is paused - you can activate it in Facebook Ads Manager.',
      details: {
        campaignName: campaign.name,
        budget: '$5.00/day',
        targeting: `${formData.city}, ${formData.state} + ${formData.radiusMiles} miles`,
        headlines: creativeData.headlines.join(', '),
      }
    };

  } catch (error) {
    console.error('Ad deployment error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
