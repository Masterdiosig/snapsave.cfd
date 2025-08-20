import axios from "axios";

const cache = new Map();
const TTL = 10 * 60 * 1000; // 10 phút cache

const allowedOrigins = [
  "https://snaptik.pics",
  "https://www.snaptik.pics",
  "http://localhost:3000"
];

// --- Helpers ---
async function followRedirect(u) {
  try {
    const r = await axios.get(u, {
      maxRedirects: 5,
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    return r.request?.res?.responseUrl || u;
  } catch {
    return u;
  }
}

async function fetchHtml(u) {
  const r = await axios.get(u, {
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return r.data;
}

function extractJson(html) {
  // thử __NEXT_DATA__
  let m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      return { type: "NEXT", data: JSON.parse(m[1]) };
    } catch {}
  }
  // thử SIGI_STATE
  m = html.match(/<script[^>]+id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      return { type: "SIGI", data: JSON.parse(m[1]) };
    } catch {}
  }
  return null;
}

function parseVideo(j) {
  if (j.type === "NEXT") {
    const item = j.data?.props?.pageProps?.itemInfo?.itemStruct;
    if (!item) return null;
    return {
      id: item.id,
      desc: item.desc,
      cover: item.video?.cover || item.video?.originCover,
      noWM: item.video?.playAddr,
      wm: item.video?.downloadAddr,
      music: item.music?.playUrl,
      author: item.author?.nickname || item.author?.uniqueId
    };
  } else if (j.type === "SIGI") {
    const mod = j.data?.ItemModule;
    if (!mod) return null;
    const firstKey = Object.keys(mod)[0];
    const v = mod[firstKey];
    if (!v) return null;
    return {
      id: v.id,
      desc: v.desc,
      cover: v.video?.cover,
      noWM: v.video?.playAddr,
      wm: v.video?.downloadAddr,
      music: v.music?.playUrl,
      author: v.author
    };
  }
  return null;
}

function buildResponse(vd) {
  const arr = [];
  if (vd.noWM) arr.push({ url: vd.noWM, label: "Tải không watermark" });
  if (vd.wm && vd.wm !== vd.noWM) arr.push({ url: vd.wm, label: "Tải có watermark" });
  if (vd.music) arr.push({ url: vd.music, label: "Tải nhạc" });

  return {
    code: 0,
    data: arr,
    meta: {
      thumbnail: vd.cover,
      description: vd.desc,
      author: vd.author
    }
  };
}

function getId(u) {
  try {
    const url = new URL(u);
    const parts = url.pathname.split("/");
    const i = parts.indexOf("video");
    if (i !== -1 && parts[i + 1]) return parts[i + 1];
  } catch {}
  return null;
}

// --- API handler ---
export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (allowedOrigins.some((o) => origin.startsWith(o))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ code: 1, message: "Thiếu URL" });

  try {
    const finalUrl = await followRedirect(url);
    const vid = getId(finalUrl);

    // check cache
    if (vid && cache.has(vid)) {
      const c = cache.get(vid);
      if (Date.now() - c.time < TTL) return res.status(200).json(c.data);
    }

    const html = await fetchHtml(finalUrl);
    const j = extractJson(html);

    if (!j) return res.status(200).json({ code: 2, message: "Không tìm thấy JSON TikTok" });

    const vd = parseVideo(j);
    if (!vd || !(vd.noWM || vd.wm)) {
      console.log("⚠️ Debug JSON:", JSON.stringify(j).slice(0, 500)); // log ra cho dễ check
      return res.status(200).json({ code: 2, message: "Không tìm thấy video!" });
    }

    const payload = buildResponse(vd);
    if (vid) cache.set(vid, { time: Date.now(), data: payload });

    return res.status(200).json(payload);
  } catch (err) {
    console.error("❌ Error parse:", err.message);
    return res.status(500).json({ code: 500, message: "Server error", error: err.message });
  }
}


