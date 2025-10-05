const axios = require('axios');
const cheerio = require('cheerio');

async function tmdbScrape(tmdbId, type, season, episode) {
  const vidsrcBase = "https://vidsrc.me"; // Try .me first; fallback to .to if needed
  const embedPath = type === "movie" ? `/embed/movie/${tmdbId}` : `/embed/tv/${tmdbId}/${season}/${episode}`;
  const embedUrl = `${vidsrcBase}${embedPath}`;

  try {
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': vidsrcBase,
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin'
      },
      timeout: 10000,
      maxRedirects: 3
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const html = response.data;
    const $ = cheerio.load(html);
    const sources = [];

    // Parse m3u8 sources from <source> tags or data attributes
    $('source[src$=".m3u8"]').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        sources.push({
          name: "Vidsrc Stream",
          image: "", // Can add TMDB poster here if needed
          mediaId: tmdbId,
          stream: src.startsWith('http') ? src : new URL(src, vidsrcBase).href
        });
      }
    });

    // Fallback: Parse from video player data (Vidsrc often uses JWPlayer or similar)
    if (sources.length === 0) {
      const videoData = html.match(/sources:\s*\[([^\]]+)\]/) || html.match(/playlist:\s*\[([^\]]+)\]/);
      if (videoData) {
        const fileRegex = /file:"([^"]+\.m3u8)"/g;
        let match;
        while ((match = fileRegex.exec(videoData[1])) !== null) {
          sources.push({
            name: "Vidsrc Fallback Stream",
            image: "",
            mediaId: tmdbId,
            stream: match[1].startsWith('http') ? match[1] : new URL(match[1], vidsrcBase).href
          });
        }
      }
    }

    // Fallback: Try API endpoint if available (some Vidsrc sites have /api/sources)
    if (sources.length === 0) {
      const apiUrl = `${vidsrcBase}/api/sources/${tmdbId}${type === "tv" ? `?season=${season}&episode=${episode}` : ""}`;
      try {
        const apiResponse = await axios.get(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
        const apiData = apiResponse.data;
        if (apiData.sources && apiData.sources.length > 0) {
          const stream = apiData.sources[0].file || apiData.sources[0].src;
          sources.push({
            name: "Vidsrc API Stream",
            image: "",
            mediaId: tmdbId,
            stream: stream
          });
        }
      } catch (apiError) {
        console.warn('API fallback failed:', apiError.message);
      }
    }

    return sources.length > 0 ? sources : [];
  } catch (error) {
    console.error('Scrape error:', error.message);
    return [];
  }
}

module.exports = tmdbScrape;
