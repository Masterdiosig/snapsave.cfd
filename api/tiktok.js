// /api/tiktok.js
import axios from "axios";

// ----- Config -----
const TTL_MS = 10 * 60 * 1000; // cache 10 phút
const allowedOrigins = [
  "https://snaptik.pics",
  "https://www.snaptik.pics",
  "http://localhost:3000"
];

// ----- Cache RAM đơn giản -----
const cache = new Map(); // key: videoID, value: { data, time }
const getCache = (id) => {
  const c = cache.get(id);
  if (!c) return null;
  if (Date.now() - c.time > TTL_MS) {
    cache.delete(id);
    return null;
  }
  return c.data;
};
const setCache = (id, data) => cache.set(id, { data, time: Date.now() });

// ----- Helpers -----
async function followRedirect(u) {
  try {
    const r = await axios.get(u, {
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "vi,en-US;q=0.9,en;q=0.8"
      }
    });
    return r.request?.res?.responseUrl || u;
  } catch {
    return u;
  }
}

async function fetchHtml(u) {
  const r = await axios.get(u, {
    timeout: 12000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "vi,en-US;q=0.9,en;q=0.8"
    }
  });
  return r.data;
}

function extractJson(html) {
  // Ưu tiên __NEXT_DATA__
  const reNext = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
  const m1 = html.match(reNext);
  if (m1) {
    try { return { type: "NEXT", data: JSON.parse(m1[1]) }; } catch {}
  }
  // Fallback: SIGI_STATE
  const reSigi = /<script[^>]+id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/;
  const m2 = html.match(reSigi);
  if (m2) {
    try { return { type: "SIGI", data: JSON.parse(m2[1]) }; } catch {}
  }
  return null;
}

function parseFromNext(nextJson) {
  const item = nextJson?.props?.pageProps?.itemInfo?.itemStruct;
  if (!item?.video) return null;
  return {
    id: item.id,
    desc: item.desc,
    cover: item.video.cover || item.video.originCover || item.video.dynamicCover,
    noWM: item.video.playAddr || item.video.playAddrH264 || null,
    wm: item.video.downloadAddr || null,
    music: item.music?.playUrl || item.music?.playUrlH264 || null,
    author:
      item.author?.nickname ||
      item.author?.uniqueId ||
      item.author?.unique_id ||
      ""
  };
}

function parseFromSigi(sigi) {
  const mod = sigi?.ItemModule;
  if (!mod) return null;
  const firstKey = Object.keys(mod)[0];
  const v = mod[firstKey];
  if (!v?.video) return null;
  return {
    id: v.id,
    desc: v.desc,
    cover: v.video.cover || v.video.dynamicCover,
    noWM: v.video.playAddr || null,
    wm: v.video.downloadAddr || null,
    music: v.music?.playUrl || null,
    author: v.author || ""
  };
}

function buildList(vd) {
  const arr = [];
  if (vd.noWM) arr.push({ url: vd.noWM, label: "Tải không watermark" });
  if (vd.wm && vd.wm !== vd.noWM) arr.push({ url: vd.wm, label: "Tải có watermark" });
  if (vd.music) arr.push({ url: vd.music, label: "Tải nhạc" });
  return arr;
}

function getVideoIdFromUrl(u) {
  try {
    const url = new URL(u);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "video");
    if (i !== -1 && parts[i + 1]) return parts[i + 1];
  } catch {}
  return (u.split("/").pop() || "").split("?")[0];
}

// ----- API handler -----
export default async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || "";
  if (allowedOrigins.some((o) => origin.startsWith(o))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Nếu muốn khóa bằng token, bật đoạn dưới:
  // const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  // const secret = process.env.API_SECRET_TOKEN || "my_super_secret_token_123";
  // if (!token || token !== secret) return res.status(403).json({ error: "Forbidden - Invalid token" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ code: 1, message: "Thiếu URL" });

  try {
    const finalUrl = await followRedirect(url);
    const vid = getVideoIdFromUrl(finalUrl);

    // Cache hit?
    const cached = getCache(vid);
    if (cached) return res.status(200).json(cached);

    // Fetch & parse
    const html = await fetchHtml(finalUrl);
    const j = extractJson(html);
    if (!j) return res.status(200).json({ code: 2, message: "Không đọc được dữ liệu TikTok" });

    const vd =
      j.type === "NEXT" ? parseFromNext(j.data)
      : j.type === "SIGI" ? parseFromSigi(j.data)
      : null;

    if (!vd || !(vd.noWM || vd.wm || vd.music)) {
      return res.status(200).json({ code: 2, message: "Không tìm thấy link video hợp lệ" });
    }

    const payload = {
      code: 0,
      data: buildList(vd),
      meta: {
        thumbnail: vd.cover || "",
        description: vd.desc || "",
        author: vd.author || ""
      }
    };

    setCache(vid, payload);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Parse error:", err?.message);
    return res.status(500).json({ code: 500, message: "Lỗi server", error: err?.message });
  }
}

