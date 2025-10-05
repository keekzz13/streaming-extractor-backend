const express = require('express');
const tmdbScrape = require('./vidsrc.js');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/stream', async (req, res) => {
  const { tmdbId, type, season, episode } = req.query;
  if (!tmdbId || !type) {
    return res.status(400).json({ error: 'Missing tmdbId or type' });
  }

  try {
    const streams = await tmdbScrape(tmdbId, type, season ? parseInt(season) : undefined, episode ? parseInt(episode) : undefined);
    if (streams.length === 0) {
      return res.status(404).json({ error: 'No streams found', details: 'Try a different TMDB ID or provider' });
    }
    console.log(`Found ${streams.length} streams for ${tmdbId}`);
    res.json(streams);
  } catch (error) {
    console.error('Extraction error:', error.message);
    res.status(500).json({ error: 'Extraction failed', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Extractor server running on http://localhost:${PORT}`);
});
