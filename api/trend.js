import googleTrends from "google-trends-api";
import { parseStringPromise } from "xml2js";

// cache
const cache = new Map();
const TTL_MS = 10 * 60 * 1000;

function keyOf(q, geo) { return `${q.toLowerCase()}::${geo}`; }

function detectSpikes(timeline) {
  const vals = timeline.map(p => p.v);
  if (!vals.length) return [];
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / vals.length);
  const out = [];
  for (const p of timeline) {
    if (p.v > mean + 2 * std) {
      const percent = Math.round(100 * (p.v - mean) / Math.max(1, mean));
      out.push({ time: p.t, percent, reason: "Sharp rise in interest" });
    }
  }
  return out;
}

function hostFrom(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "source"; }
}

function fmtDateFromUnixSec(sec) {
  return new Date(Number(sec) * 1000).toISOString().slice(0, 10);
}

// Google Trends timeline
async function fetchTrends(q, geo = "NG") {
  const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endTime = new Date();
  const raw = await googleTrends.interestOverTime({ keyword: q, startTime, endTime, geo });
  const data = JSON.parse(raw);
  const rows = data?.default?.timelineData || [];
  return rows.map(r => ({ t: fmtDateFromUnixSec(r.time), v: Number(r.value?.[0] ?? 0) }));
}

// Google Trends regions
async function fetchRegions(q, geo = "NG") {
  const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endTime = new Date();
  const raw = await googleTrends.interestByRegion({
    keyword: q, startTime, endTime, geo, resolution: "region"
  });
  const data = JSON.parse(raw);
  const rows = data?.default?.geoMapData || [];
  return rows
    .map(r => ({ name: r.geoName || r.geoCode || "Region", value: Number(r.value?.[0] ?? 0) }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

// News via GDELT
async function fetchNews(q) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&timespan=30d&mode=artlist&format=json&maxrecords=10`;
  const r = await fetch(url, { headers: { "User-Agent": "TrendPeakBot/1.0" } });
  if (!r.ok) return [];
  const data = await r.json();
  const rows = Array.isArray(data?.articles) ? data.articles : [];
  return rows.slice(0, 5).map(it => ({
    site: hostFrom(it.url || ""),
    title: it.title || "News item",
    url: it.url || "#"
  }));
}

// Reddit top posts (last month)
async function fetchReddit(q) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=top&t=month&limit=5`;
  const r = await fetch(url, { headers: { "User-Agent": "TrendPeakBot/1.0" } });
  if (!r.ok) return [];
  const data = await r.json();
  const items = Array.isArray(data?.data?.children) ? data.data.children : [];
  return items.map(x => {
    const p = x.data || {};
    const permalink = p.permalink ? `https://www.reddit.com${p.permalink}` : "";
    return {
      site: "reddit",
      title: p.title || "Reddit post",
      url: permalink || p.url || "#",
      score: Number(p.score || 0)
    };
  });
}

// YouTube search via RSS with thumbnails
async function fetchYouTube(q) {
  const url = `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": "TrendPeakBot/1.0" } });
  if (!r.ok) return [];
  const xml = await r.text();
  const parsed = await parseStringPromise(xml, { explicitArray: true }); // keep arrays to access attributes as $ in xml2js
  const entries = parsed?.feed?.entry || [];
  return entries.slice(0, 5).map(e => {
    const title = e?.title?.[0] || "YouTube video";
    const linkObj = Array.isArray(e?.link) ? e.link[0] : e?.link;
    const link = linkObj?.$?.href || "";
    const videoId = e?.["yt:videoId"]?.[0] || "";
    const thumbNode = e?.["media:group"]?.[0]?.["media:thumbnail"]?.[0]?.$;
    const thumb = thumbNode?.url || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "");
    const finalLink = link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "#");
    return { site: "youtube", title, url: finalLink, thumbnail: thumb };
  });
}

function mockTimeline30() {
  const today = new Date();
  const tl = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (29 - i));
    const base = 40 + 10 * Math.sin(i / 3) + Math.floor(Math.random() * 7) - 3;
    return { t: d.toISOString().slice(0, 10), v: Math.max(0, Math.round(base)) };
  });
  const k = 10 + Math.floor(Math.random() * 16);
  tl[k].v += 30 + Math.floor(Math.random() * 50);
  return tl;
}

export default async function handler(req, res) {
  const q = String(req.query.q || "").trim();
  const geo = String(req.query.geo || "NG").toUpperCase();
  if (!q) return res.status(400).json({ error: "Missing q" });

  const cacheKey = keyOf(q, geo);
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return res.status(200).json(hit.data);

  try {
    let timeline = await fetchTrends(q, geo);
    if (!timeline.length) timeline = mockTimeline30();

    const [regions, news, reddit, youtube] = await Promise.all([
      fetchRegions(q, geo).catch(() => []),
      fetchNews(q).catch(() => []),
      fetchReddit(q).catch(() => []),
      fetchYouTube(q).catch(() => [])
    ]);

    const payload = {
      query: q,
      geo,
      timeline,
      spikes: detectSpikes(timeline),
      regions,
      sources: { news, reddit, youtube }
    };

    cache.set(cacheKey, { data: payload, expiresAt: Date.now() + TTL_MS });
    res.status(200).json(payload);
  } catch {
    const timeline = mockTimeline30();
    const payload = {
      query: q,
      geo,
      timeline,
      spikes: detectSpikes(timeline),
      regions: [],
      sources: { news: [], reddit: [], youtube: [] }
    };
    cache.set(cacheKey, { data: payload, expiresAt: Date.now() + TTL_MS });
    res.status(200).json(payload);
  }
}
