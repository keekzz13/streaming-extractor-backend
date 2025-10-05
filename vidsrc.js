const axios = require('axios');
const cheerio = require('cheerio');

async function tmdbScrape(tmdbId, type, season, episode) {
  const vidsrcBase = "https://vidsrc.me"; // Primary; fallback to .to if needed
  const isMovie = type === "movie";
  const embedPath = isMovie ? `/embed/movie/${tmdbId}` : `/embed/tv/${tmdbId}/${season}/${episode}`;
  const embedUrl = `${vidsrcBase}${embedPath}`;

  try {
    // Fetch embed page with browser headers to bypass Cloudflare
    const embedResponse = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': vidsrcBase,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache'
      },
      timeout: 10000,
      maxRedirects: 3
    });

    if (embedResponse.status !== 200) {
      throw new Error(`Embed fetch failed: ${embedResponse.status}`);
    }

    const $ = cheerio.load(embedResponse.data);

    // Extract source IDs from JWPlayer config or data attributes
    const sources = [];
    const playerScript = $('script').filter((i, el) => $(el).html().includes('jwplayer')).html() || '';
    const sourceIds = playerScript.match(/sourceId['"]?\s*:\s*['"](\d+)['"]/g) || [];

    if (sourceIds.length === 0) {
      // Fallback: Look for data-source or hidden divs
      $('div[data-source-id]').each((i, el) => {
        const sourceId = $(el).attr('data-source-id');
        if (sourceId) sourceIds.push(sourceId);
      });
    }

    for (const sourceIdStr of sourceIds) {
      const sourceId = sourceIdStr.match(/(\d+)/)[1];
      try {
        // Fetch sources API
        const sourcesUrl = `${vidsrcBase}/embed/sources/${sourceId}`;
        const sourcesResponse = await axios.get(sourcesUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'Referer': embedUrl,
            'Accept': 'application/json'
          },
          timeout: 5000
        });

        const sourcesData = sourcesResponse.data;
        if (sourcesData.sources && sourcesData.sources.length > 0) {
          const stream = sourcesData.sources[0].file || sourcesData.sources[0].src;
          if (stream && stream.endsWith('.m3u8')) {
            sources.push({
              name: sourcesData.sources[0].label || "Vidsrc Stream",
              image: "", // Optional TMDB poster
              mediaId: tmdbId,
              stream: stream
            });
          }
        }
      } catch (sourceError) {
        console.warn(`Source ${sourceId} failed:`, sourceError.message);
      }
    }

    // Fallback: Direct regex on embed HTML for inline m3u8
    if (sources.length === 0) {
      const m3u8Regex = /"file" *: *"(https?://[^"]+\.m3u8[^"]*)"/g;
      let match;
      while ((match = m3u8Regex.exec(embedResponse.data)) !== null) {
        sources.push({
          name: "Inline Stream",
          image: "",
          mediaId: tmdbId,
          stream: match[1]
        });
      }
    }

    return sources.length > 0 ? sources : [];
  } catch (error) {
    console.error('Scrape error:', error.message);
    // Fallback to alternative Vidsrc domain (e.g., vidsrc.to)
    return await scrapeWithFallback(tmdbId, type, season, episode, "https://vidsrc.to");
  }
}

async function scrapeWithFallback(tmdbId, type, season, episode, baseUrl) {
  // Recursive fallback to .to if .me fails
  // Implement similar logic as above with baseUrl
  // For brevity, return [] if fallback fails
  return [];
}

module.exports = tmdbScrape;
