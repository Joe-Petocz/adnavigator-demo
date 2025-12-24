// Facebook Marketing API Integration

const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;
const FB_API_VERSION = 'v21.0';

/**
 * Initialize Facebook SDK
 */
export const initFacebookSDK = () => {
  return new Promise((resolve) => {
    // Load Facebook SDK
    window.fbAsyncInit = function() {
      window.FB.init({
        appId: FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: FB_API_VERSION
      });
      resolve();
    };

    // Load SDK script
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      document.body.appendChild(script);
    } else {
      // SDK already loaded
      resolve();
    }
  });
};

/**
 * Login with Facebook and request necessary permissions
 */
export const loginWithFacebook = () => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not initialized. Call initFacebookSDK() first.'));
      return;
    }

    window.FB.login(
      (response) => {
        if (response.authResponse) {
          console.log('Facebook login successful');
          resolve(response.authResponse);
        } else {
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
    const { city, state, radiusMiles, website } = adSetData;

    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/adsets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          name: `${city}, ${state} - ${radiusMiles}mi`,
          campaign_id: campaignId,
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LEAD_GENERATION',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // Lowest cost bid
          status: 'PAUSED',
          // Geo-targeting: city + state + radius
          targeting: {
            geo_locations: {
              cities: [
                {
                  key: `${city},${state}`, // Format: "CityName,ST"
                  radius: radiusMiles,
                  distance_unit: 'mile'
                }
              ]
            },
            age_min: 25,
            age_max: 65,
          },
          // Promoted object (website destination)
          promoted_object: {
            pixel_id: null, // Can add pixel if available
            custom_event_type: 'LEAD'
          },
          destination_type: 'WEBSITE',
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
    const { headlines, primaryText, cta, website, videoId } = creativeData;

    const creativePayload = {
      access_token: accessToken,
      name: `Creative - ${headlines[0].substring(0, 30)}`,
      object_story_spec: {
        page_id: null, // Will be set by user's page
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

    // 1. Initialize Facebook SDK
    await initFacebookSDK();
    console.log('Facebook SDK initialized');

    // 2. Login and get access token
    const authResponse = await loginWithFacebook();
    const accessToken = authResponse.accessToken;
    console.log('User authenticated');

    // 3. Get ad accounts
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
      videoId: videoId
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
