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
    }
  });
};

/**
 * Login with Facebook and request necessary permissions
 */
export const loginWithFacebook = () => {
  return new Promise((resolve, reject) => {
    window.FB.login(
      (response) => {
        if (response.authResponse) {
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
      `https://graph.facebook.com/${FB_API_VERSION}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
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
 * Create a campaign in Facebook Ads
 */
export const createCampaign = async (accessToken, adAccountId, campaignData) => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/campaigns`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          name: campaignData.name || 'AdNavigator Campaign',
          objective: 'OUTCOME_TRAFFIC', // or OUTCOME_SALES, OUTCOME_LEADS
          status: 'PAUSED', // Start paused for safety
          special_ad_categories: [],
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
};

/**
 * Create an ad set within a campaign
 */
export const createAdSet = async (accessToken, adAccountId, campaignId, adSetData) => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/adsets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          name: adSetData.name || 'AdNavigator Ad Set',
          campaign_id: campaignId,
          daily_budget: adSetData.dailyBudget || 2000, // $20 in cents
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          bid_amount: adSetData.bidAmount || 200,
          status: 'PAUSED',
          targeting: {
            geo_locations: {
              countries: adSetData.countries || ['US']
            },
            age_min: adSetData.ageMin || 18,
            age_max: adSetData.ageMax || 65,
          },
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data;
  } catch (error) {
    console.error('Error creating ad set:', error);
    throw error;
  }
};

/**
 * Complete ad deployment flow
 */
export const deployAdCampaign = async (creativeData, formData) => {
  try {
    // 1. Initialize Facebook SDK
    await initFacebookSDK();

    // 2. Login and get access token
    const authResponse = await loginWithFacebook();
    const accessToken = authResponse.accessToken;

    // 3. Get ad accounts
    const adAccounts = await getAdAccounts(accessToken);

    if (!adAccounts || adAccounts.length === 0) {
      throw new Error('No ad accounts found. Please create an ad account in Facebook Business Manager.');
    }

    // Use first active ad account
    const activeAccount = adAccounts.find(acc => acc.account_status === 1) || adAccounts[0];

    // 4. Create campaign
    const campaign = await createCampaign(accessToken, activeAccount.id, {
      name: `${formData.name} - AdNavigator Campaign`
    });

    // 5. Create ad set
    const adSet = await createAdSet(accessToken, activeAccount.id, campaign.id, {
      name: `${formData.name} - Ad Set`,
      dailyBudget: 2000, // $20/day
      countries: ['US'], // Can be customized based on formData
    });

    return {
      success: true,
      campaign,
      adSet,
      adAccount: activeAccount,
      message: 'Campaign created successfully! You can now activate it in Facebook Ads Manager.'
    };

  } catch (error) {
    console.error('Ad deployment error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
