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
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000,
      maxRedirects: 3
    });

    if (embedResponse.status !== 200) {
      throw new Error(`Embed fetch failed: ${embedResponse.status}`);
    }

    const html = embedResponse.data;
    const $ = cheerio.load(html);
    const sources = [];

    // Extract source IDs from JWPlayer config or data attributes
    const playerScript = $('script').filter((i, el) => $(el).html().includes('jwplayer')).html() || '';
    let sourceIds = playerScript.match(/sourceId['"]?\s*:\s*['"](\d+)['"]/g) || [];

    if (sourceIds.length === 0) {
      // Fallback: Look for data-source-id or similar attributes
      $('div[data-source-id], [data-id]').each((i, el) => {
        const sourceId = $(el).attr('data-source-id') || $(el).attr('data-id');
        if (sourceId) sourceIds.push(`sourceId:"${sourceId}"`);
      });
    }

    // Fetch each source ID's API endpoint
    for (const sourceIdStr of sourceIds) {
      const sourceId = sourceIdStr.match(/(\d+)/)[1];
      try {
        const sourcesUrl = `${vidsrcBase}/embed/sources/${sourceId}`;
        const sourcesResponse = await axios.get(sourcesUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'Referer': embedUrl,
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          timeout: 5000
        });

        const sourcesData = sourcesResponse.data;
        if (sourcesData.sources && sourcesData.sources.length > 0) {
          const stream = sourcesData.sources[0].file || sourcesData.sources[0].src;
          if (stream && stream.endsWith('.m3u8')) {
            sources.push({
              name: sourcesData.sources[0].label || "Vidsrc Stream",
              image: "", // Optional: Add TMDB poster via API
              mediaId: tmdbId,
              stream: stream
            });
          }
        }
      } catch (sourceError) {
        console.warn(`Source ${sourceId} failed: ${sourceError.message}`);
      }
    }

    // Fallback: Parse inline m3u8 from HTML (fixed regex)
    if (sources.length === 0) {
      const m3u8Regex = /"file"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/g;
      let match;
      while ((match = m3u8Regex.exec(html)) !== null) {
        sources.push({
          name: "Inline Stream",
          image: "",
          mediaId: tmdbId,
          stream: match[1]
        });
      }
    }

    // Log for debugging
    console.log(`Extracted ${sources.length} streams for ${tmdbId}:`, sources.map(s => s.stream));

    return sources.length > 0 ? sources : [];
  } catch (error) {
    console.error('Scrape error:', error.message);
    // Fallback to vidsrc.to
    return await scrapeWithFallback(tmdbId, type, season, episode, "https://vidsrc.to");
  }
}

async function scrapeWithFallback(tmdbId, type, season, episode, baseUrl) {
  const isMovie = type === "movie";
  const embedPath = isMovie ? `/embed/movie/${tmdbId}` : `/embed/tv/${tmdbId}/${season}/${episode}`;
  const embedUrl = `${baseUrl}${embedPath}`;

  try {
    const embedResponse = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': baseUrl
      },
      timeout: 10000,
      maxRedirects: 3
    });

    const html = embedResponse.data;
    const $ = cheerio.load(html);
    const sources = [];

    // Similar parsing as above
    const playerScript = $('script').filter((i, el) => $(el).html().includes('jwplayer')).html() || '';
    let sourceIds = playerScript.match(/sourceId['"]?\s*:\s*['"](\d+)['"]/g) || [];

    if (sourceIds.length === 0) {
      $('div[data-source-id], [data-id]').each((i, el) => {
        const sourceId = $(el).attr('data-source-id') || $(el).attr('data-id');
        if (sourceId) sourceIds.push(`sourceId:"${sourceId}"`);
      });
    }

    for (const sourceIdStr of sourceIds) {
      const sourceId = sourceIdStr.match(/(\d+)/)[1];
      try {
        const sourcesUrl = `${baseUrl}/embed/sources/${sourceId}`;
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
              image: "",
              mediaId: tmdbId,
              stream: stream
            });
          }
        }
      } catch (sourceError) {
        console.warn(`Fallback source ${sourceId} failed: ${sourceError.message}`);
      }
    }

    if (sources.length === 0) {
      const m3u8Regex = /"file"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/g;
      let match;
      while ((match = m3u8Regex.exec(html)) !== null) {
        sources.push({
          name: "Inline Stream",
          image: "",
          mediaId: tmdbId,
          stream: match[1]
        });
      }
    }

    console.log(`Fallback extracted ${sources.length} streams for ${tmdbId}:`, sources.map(s => s.stream));
    return sources;
  } catch (error) {
    console.error('Fallback scrape error:', error.message);
    return [];
  }
}

module.exports = tmdbScrape;
