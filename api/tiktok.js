import axios from "axios";

const followRedirect = async (shortUrl) => {
  try {
    const response = await axios.get(shortUrl, {
      maxRedirects: 5,
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    return response.request?.res?.responseUrl || shortUrl;
  } catch (err) {
    console.warn("⚠️ Lỗi redirect:", err.message);
    return shortUrl;
  }
};

export default async function handler(req, res) {
  const allowedOrigins = [
    "https://snapth.vercel.app",
    "https://snaptik.pics",
    "https://www.snaptik.pics"
  ];
  const secretToken = process.env.API_SECRET_TOKEN;
  const origin = req.headers.origin || req.headers.referer || "";
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();

  // ✅ CORS
  if (allowedOrigins.some((o) => origin.startsWith(o))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    console.warn("⛔ Bị chặn: sai domain:", origin);
    return res.status(403).json({ error: "Forbidden - Invalid origin" });
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // 🔐 Token
  if (!token || token !== secretToken) {
    console.warn("⛔ Bị chặn: sai token:", token);
    return res.status(403).json({ error: "Forbidden - Invalid token" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ code: 1, message: "Thiếu URL" });

  const finalUrl = await followRedirect(url);
  console.log("🔗 Final TikTok URL:", finalUrl);

  // --- Ưu tiên RapidAPI ---
  try {
    const response = await axios.get(
      "https://tiktok-download-video1.p.rapidapi.com/newGetVideo",
      {
        params: { url: finalUrl, hd: "1" },
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "tiktok-download-video1.p.rapidapi.com"
        },
        timeout: 8000
      }
    );

    const data = response.data?.data || {};
    const videoHD = data.hdplay;
    const videoSD = data.play;
    const audio = data.music;
    const downloadUrl = data.downloadUrl;

    const list = [
      ...(videoSD ? [{ url: videoSD, label: "Tải không watermark" }] : []),
      ...(videoHD ? [{ url: videoHD, label: "Tải HD" }] : []),
      ...(audio ? [{ url: audio, label: "Tải nhạc" }] : []),
      ...(downloadUrl ? [{ url: downloadUrl, label: "Tải video (RapidAPI)" }] : [])
    ];

    if (list.length > 0) {
      return res.status(200).json({
        code: 0,
        data: list,
        meta: {
          thumbnail: data.cover,
          description: data.description || data.title,
          author:
            data.author?.nickname ||
            data.author?.username ||
            data.author?.unique_id ||
            ""
        }
      });
    }

    console.warn("⚠️ RapidAPI không trả về link hợp lệ, fallback oEmbed...");
  } catch (err) {
    console.error("❌ RapidAPI lỗi:", err.message);
  }

  // --- Fallback oEmbed ---
  try {
    const oembedRes = await axios.get(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(finalUrl)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 }
    );

    const oembed = oembedRes.data || {};
    return res.status(200).json({
      code: 2,
      data: [],
      meta: {
        thumbnail: oembed.thumbnail_url,
        description: oembed.title,
        author: oembed.author_name
      },
      message: "Chỉ lấy được thông tin, không tải video"
    });
  } catch (err) {
    console.error("❌ Fallback oEmbed lỗi:", err.message);
    return res.status(500).json({
      code: 500,
      message: "Không thể lấy dữ liệu từ TikTok",
      error: err.message
    });
  }
}


