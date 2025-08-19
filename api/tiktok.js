import axios from "axios";

// ===== Config =====
const allowedOrigins = [
  "https://snaptik.pics",
  "https://www.snaptik.pics",
  "https://snapth.vercel.app",
  "http://localhost:3000"
];
const TTL_MS = 10 * 60 * 1000; // cache 10 phút

// ===== Cache RAM đơn giản =====
const cache = new Map(); // key: videoID, value: { data, time }

function getCache(id){
  const c = cache.get(id);
  if (!c) return null;
  if (Date.now() - c.time > TTL_MS) { cache.delete(id); return null; }
  return c.data;
}
function setCache(id, data){ cache.set(id, { data, time: Date.now() }); }

// ===== Helpers =====
function extractNextData(html) {
  // __NEXT_DATA__
  const reNext = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
  const mNext = html.match(reNext);
  if (mNext) {
    try { return JSON.parse(mNext[1]); } catch {}
  }
  // Fallback: SIGI_STATE
  const reSigi = /<script[^>]+id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/;
  const mSigi = html.match(reSigi);
  if (mSigi) {
    try { return { SIGI_STATE: JSON.parse(mSigi[1]) }; } catch {}
  }
  return null;
}

function parseFromNext(json) {
  // __NEXT_DATA__ path
  const item = json?.props?.pageProps?.itemInfo?.itemStruct;
  if (item?.video) {
    return {
      id: item.id,
      desc: item.desc,
      cover: item.video.cover || item.video.originCover || item.video.dynamicCover,
      noWatermark: item.video.playAddr || item.video.playAddrH264 || item.video.downloadAddr, // tuỳ region
      watermark: item.video.downloadAddr || null,
      music: item.music?.playUrl || item.music?.playUrlH264 || null,
      author:
        item.author?.nickname ||
        item.author?.uniqueId ||
        item.author?.unique_id ||
        ""
    };
  }

  // Fallback SIGI_STATE (đôi khi trả về cấu trúc khác)
  const sigi = json?.SIGI_STATE;
  if (sigi?.ItemModule) {
    const firstKey = Object.keys(sigi.ItemModule)[0];
    const v = sigi.ItemModule[firstKey];
    return {
      id: v?.id,
      desc: v?.desc,
      cover: v?.video?.cover || v?.video?.dynamicCover,
      noWatermark: v?.video?.playAddr || v?.video?.downloadAddr,
      watermark: v?.video?.downloadAddr || null,
      music: v?.music?.playUrl || null,
      author: v?.author || ""
    };
  }

  return null;
}

function getVideoIdFromUrl(u) {
  try {
    const url = new URL(u);
    // /@user/video/1234567890
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex(p => p === "video");
    if (idx !== -1 && parts[idx+1]) return parts[idx+1];
  } catch {}
  // fallback: chuỗi cuối
  return (u.split("/").pop() || "").split("?")[0];
}

async function followRedirect(u) {
  try {
    const r = await axios.get(u, {
      maxRedirects: 5,
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "vi,en-US;q=0.9,en;q=0.8"
      }
    });
    // axios theo redirect, r.request.res.responseUrl đôi khi có URL cuối
    return r.request?.res?.responseUrl || u;
  } catch {
    return u;
  }
}

async function fetchHtml(u) {
  const r = await axios.get(u, {
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "vi,en-US;q=0.9,en;q=0.8"
    }
  });
  return r.data;
}

function buildList(vd) {
  const out = [];
  if (vd.noWatermark) out.push({ url: vd.noWatermark, label: "Tải không watermark" });
  if (vd.watermark && vd.watermark !== vd.noWatermark) out.push({ url: vd.watermark, label: "Tải có watermark" });
  if (vd.music) out.push({ url: vd.music, label: "Tải nhạc" });
  return out;
}

// ===== Handler =====
export default async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || "";
  if (allowedOrigins.some(o => origin.startsWith(o))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();
  const secret = process.env.API_SECRET_TOKEN || "my_super_secret_token_123";
  if (!token || token !== secret) {
    return res.status(403).json({ error: "Forbidden - Invalid token" });
  }

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ code: 1, message: "Thiếu URL" });

  try {
    const finalUrl = await followRedirect(url);
    const vid = getVideoIdFromUrl(finalUrl);

    // Cache
    const cached = getCache(vid);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Fetch & parse
    const html = await fetchHtml(finalUrl);
    const json = extractNextData(html);
    if (!json) {
      return res.status(200).json({ code: 2, message: "Không đọc được dữ liệu TikTok" });
    }

    const vd = parseFromNext(json);
    if (!vd || !(vd.noWatermark || vd.watermark || vd.music)) {
      return res.status(200).json({ code: 2, message: "Không tìm thấy link video hợp lệ" });
    }

    const list = buildList(vd);
    const payload = {
      code: 0,
      data: list,
      meta: {
        thumbnail: vd.cover || "",
        description: vd.desc || "",
        author: vd.author || ""
      }
    };

    setCache(vid, payload);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Parse error:", err.message);
    return res.status(500).json({ code: 500, message: "Lỗi server", error: err.message });
  }
}
