import googleTrends from "google-trends-api";

export default async function handler(req, res) {
  const geo = String(req.query.geo || "NG").toUpperCase();

  try {
    // daily trending searches for the region
    const raw = await googleTrends.dailyTrends({ trendDate: new Date(), geo });
    const data = JSON.parse(raw);
    const days = data?.default?.trendingSearchesDays || [];
    const items = [];
    for (const d of days) {
      for (const t of d.trendingSearches || []) {
        items.push({
          title: t?.title?.query || "",
          snippet: t?.title?.exploreLink ? `https://trends.google.com${t.title.exploreLink}` : "",
          related: (t?.relatedQueries || []).map(r => r.query).slice(0, 3),
          articles: (t?.articles || []).slice(0, 3).map(a => ({
            title: a.title,
            url: a.url
          }))
        });
      }
    }
    // dedupe and keep first 10
    const seen = new Set();
    const top = [];
    for (const it of items) {
      const key = it.title.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        top.push(it);
      }
      if (top.length >= 10) break;
    }
    res.status(200).json({ geo, top });
  } catch {
    res.status(200).json({ geo, top: [] });
  }
}
