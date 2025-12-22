/**
 * Deterministic website scraping service
 * NO LLM - extracts structured data from HTML
 */

import fetch from 'node-fetch';

/**
 * Scrape website using Jina.ai Reader API
 * Returns normalized website bundle for analysis
 *
 * @param {string} url - Website URL to scrape
 * @returns {Promise<Object>} - Website bundle with extracted data
 */
export async function scrapeWebsite(url) {
  console.log(`[SCRAPER] Starting scrape for: ${url}`);

  try {
    // Use Jina.ai Reader API for content extraction
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'json',
      },
    });

    if (!response.ok) {
      throw new Error(`Jina.ai API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract structured data
    const bundle = {
      url: url,
      scrapedAt: new Date().toISOString(),
      homepage: {
        title: data.data?.title || null,
        description: data.data?.description || null,
        content: data.data?.content || '',
        url: data.data?.url || url,
      },
      extracted: extractStructuredData(data),
      raw: {
        // Keep some raw data for debugging
        contentLength: data.data?.content?.length || 0,
        hasImages: (data.data?.images || []).length > 0,
      },
    };

    console.log(`[SCRAPER] Successfully scraped ${url}`);
    console.log(`[SCRAPER] - Content length: ${bundle.extracted.textBlocks.length} blocks`);
    console.log(`[SCRAPER] - Images found: ${bundle.extracted.images.length}`);
    console.log(`[SCRAPER] - Social links: ${bundle.extracted.socialLinks.length}`);

    return bundle;
  } catch (error) {
    console.error(`[SCRAPER] Error scraping ${url}:`, error.message);
    throw new Error(`Failed to scrape website: ${error.message}`);
  }
}

/**
 * Extract structured data from Jina.ai response
 * Deterministic parsing - no AI involved
 */
function extractStructuredData(jinaResponse) {
  const data = jinaResponse.data || {};
  const content = data.content || '';
  const images = data.images || [];
  const links = data.links || [];

  // Extract text blocks (paragraphs, headings)
  const textBlocks = extractTextBlocks(content);

  // Extract headings (H1, H2)
  const headings = extractHeadings(content);

  // Detect logo candidates
  const logos = detectLogos(images);

  // Detect hero images (large, prominent images)
  const heroImages = detectHeroImages(images);

  // Extract gallery images
  const galleryImages = detectGalleryImages(images);

  // Extract social media links
  const socialLinks = extractSocialLinks(links, content);

  // Extract contact information
  const contactInfo = extractContactInfo(content);

  return {
    textBlocks,
    headings,
    images: {
      all: images,
      logos,
      heroImages,
      galleryImages,
    },
    socialLinks,
    contactInfo,
  };
}

/**
 * Extract text blocks from content
 */
function extractTextBlocks(content) {
  if (!content) return [];

  // Split by double newlines to get paragraphs
  const blocks = content
    .split(/\n\n+/)
    .map(block => block.trim())
    .filter(block => block.length > 20 && block.length < 1000); // Filter noise

  return blocks.slice(0, 50); // Limit to first 50 blocks
}

/**
 * Extract headings from content
 */
function extractHeadings(content) {
  if (!content) return { h1: [], h2: [] };

  const lines = content.split('\n');
  const h1 = [];
  const h2 = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // H1: All caps lines or lines starting with #
    if (/^[A-Z\s]{5,}$/.test(trimmed) || /^#\s/.test(trimmed)) {
      h1.push(trimmed.replace(/^#\s/, ''));
    }
    // H2: Title case lines or lines starting with ##
    else if (/^##\s/.test(trimmed)) {
      h2.push(trimmed.replace(/^##\s/, ''));
    }
  }

  return {
    h1: h1.slice(0, 5),
    h2: h2.slice(0, 10),
  };
}

/**
 * Detect logo images
 * Heuristics: small-to-medium images with keywords in alt/filename
 */
function detectLogos(images) {
  if (!images || !Array.isArray(images)) return [];

  const logoKeywords = ['logo', 'brand', 'header', 'nav'];

  return images
    .filter(img => {
      const src = (img.src || '').toLowerCase();
      const alt = (img.alt || '').toLowerCase();

      // Check if filename or alt contains logo-related keywords
      return logoKeywords.some(keyword => src.includes(keyword) || alt.includes(keyword));
    })
    .map(img => img.src)
    .slice(0, 3); // Max 3 logo candidates
}

/**
 * Detect hero images
 * Heuristics: large images, early in page
 */
function detectHeroImages(images) {
  if (!images || !Array.isArray(images)) return [];

  // Hero keywords
  const heroKeywords = ['hero', 'banner', 'cover', 'main', 'featured'];

  const heroImages = images.filter(img => {
    const src = (img.src || '').toLowerCase();
    const alt = (img.alt || '').toLowerCase();

    return heroKeywords.some(keyword => src.includes(keyword) || alt.includes(keyword));
  });

  // If we found hero images by keyword, return those
  if (heroImages.length > 0) {
    return heroImages.map(img => img.src).slice(0, 3);
  }

  // Otherwise, return first few large images (assumed to be hero)
  return images
    .slice(0, 5)
    .map(img => img.src)
    .slice(0, 3);
}

/**
 * Detect gallery/portfolio images
 */
function detectGalleryImages(images) {
  if (!images || !Array.isArray(images)) return [];

  const galleryKeywords = ['gallery', 'portfolio', 'work', 'project', 'service'];

  return images
    .filter(img => {
      const src = (img.src || '').toLowerCase();
      const alt = (img.alt || '').toLowerCase();

      return galleryKeywords.some(keyword => src.includes(keyword) || alt.includes(keyword));
    })
    .map(img => img.src)
    .slice(0, 10); // Max 10 gallery images
}

/**
 * Extract social media links
 */
function extractSocialLinks(links, content) {
  const socialPlatforms = {
    facebook: /facebook\.com/i,
    instagram: /instagram\.com/i,
    twitter: /twitter\.com|x\.com/i,
    linkedin: /linkedin\.com/i,
    youtube: /youtube\.com/i,
    tiktok: /tiktok\.com/i,
  };

  const socialLinks = [];

  // Check links array
  if (links && Array.isArray(links)) {
    for (const link of links) {
      const href = link.href || link;
      for (const [platform, pattern] of Object.entries(socialPlatforms)) {
        if (pattern.test(href)) {
          socialLinks.push({
            platform,
            url: href,
          });
          break;
        }
      }
    }
  }

  // Also check content for social URLs
  if (content) {
    for (const [platform, pattern] of Object.entries(socialPlatforms)) {
      const matches = content.match(pattern);
      if (matches) {
        // Try to extract full URL
        const urlMatch = content.match(new RegExp(`https?://[^\\s]*${platform}[^\\s]*`, 'i'));
        if (urlMatch && !socialLinks.find(l => l.url === urlMatch[0])) {
          socialLinks.push({
            platform,
            url: urlMatch[0],
          });
        }
      }
    }
  }

  return socialLinks;
}

/**
 * Extract contact information
 */
function extractContactInfo(content) {
  if (!content) return {};

  const contactInfo = {};

  // Extract phone numbers (US format)
  const phonePattern = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
  const phones = content.match(phonePattern);
  if (phones && phones.length > 0) {
    contactInfo.phones = [...new Set(phones)].slice(0, 3); // Dedupe and limit
  }

  // Extract email addresses
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = content.match(emailPattern);
  if (emails && emails.length > 0) {
    contactInfo.emails = [...new Set(emails)].slice(0, 3);
  }

  // Extract addresses (basic heuristic)
  const addressPattern = /\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}\s*\d{5}/g;
  const addresses = content.match(addressPattern);
  if (addresses && addresses.length > 0) {
    contactInfo.addresses = [...new Set(addresses)].slice(0, 2);
  }

  return contactInfo;
}

/**
 * Normalize website bundle for analysis
 * Converts scraper output to analysis-ready format
 */
export function normalizeWebsiteBundle(scraped) {
  return {
    url: scraped.url,
    scrapedAt: scraped.scrapedAt,
    title: scraped.homepage.title,
    description: scraped.homepage.description,
    content: {
      textBlocks: scraped.extracted.textBlocks,
      headings: scraped.extracted.headings,
    },
    images: {
      logos: scraped.extracted.images.logos,
      heroImages: scraped.extracted.images.heroImages,
      galleryImages: scraped.extracted.images.galleryImages,
    },
    socialLinks: scraped.extracted.socialLinks.map(l => l.url),
    contactInfo: scraped.extracted.contactInfo,
  };
}
