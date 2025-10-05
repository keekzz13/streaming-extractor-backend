async function tmdbScrape(tmdbId, type, season, episode) {
  const vidsrcBase = "https://vidsrc.me";
  const embedPath = type === "movie" ? `/embed/movie/${tmdbId}` : `/embed/tv/${tmdbId}/${season}/${episode}`;
  const embedUrl = `${vidsrcBase}${embedPath}`;

  try {
    // Fetch embed page
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': vidsrcBase
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const html = await response.text();

    // Parse for m3u8 sources (adapt based on Vidsrc's actual structure)
    const sources = [];
    // Vidsrc often hides m3u8 in data attributes or API calls
    const sourceRegex = /data-source="([^"]+\.m3u8)"/g; // Adjust based on actual page
    let match;
    while ((match = sourceRegex.exec(html)) !== null) {
      sources.push({
        name: "Vidsrc Stream",
        image: "", // Can fetch from TMDB separately
        mediaId: tmdbId,
        stream: match[1]
      });
    }

    // Fallback: Check for API-based sources (Vidsrc may use /api/source)
    if (sources.length === 0) {
      const apiUrl = `${vidsrcBase}/api/source/${tmdbId}${type === "tv" ? `/${season}/${episode}` : ""}`;
      try {
        const apiResponse = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'Referer': embedUrl
          }
        });
        const apiData = await apiResponse.json();
        if (apiData.stream) {
          sources.push({
            name: "Vidsrc API Stream",
            image: "",
            mediaId: tmdbId,
            stream: apiData.stream
          });
        }
      } catch (apiError) {
        console.warn('API fetch failed:', apiError.message);
      }
    }

    return sources;
  } catch (error) {
    console.error('Scrape error:', error.message);
    return [];
  }
}

module.exports = tmdbScrape;
