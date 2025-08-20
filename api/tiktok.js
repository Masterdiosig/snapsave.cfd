import axios from "axios";

export default async function handler(req, res) {
  
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ code: 1, message: "Thiếu URL" });

  try {
    // 🟢 Tải HTML từ TikTok
    const htmlRes = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0 Safari/537.36"
      }
    });
    const html = htmlRes.data;

    // 🟢 Thử lấy JSON từ SIGI_STATE
    let rawJson = null;
    const matchSigi = html.match(/<script id="SIGI_STATE"[^>]*>(.*?)<\/script>/);
    if (matchSigi) {
      rawJson = matchSigi[1];
    } else {
      const matchNext = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
      if (matchNext) rawJson = matchNext[1];
    }

    if (!rawJson) {
      console.warn("⚠️ Không tìm thấy JSON trong HTML TikTok");
      return res.status(200).json({ code: 2, message: "Không tìm thấy video!" });
    }

    const json = JSON.parse(rawJson);

    // 🟢 Parse ItemModule (SIGI_STATE)
    let videoData;
    if (json.ItemModule) {
      const keys = Object.keys(json.ItemModule);
      if (keys.length > 0) videoData = json.ItemModule[keys[0]];
    } else if (json.props?.pageProps?.itemInfo?.itemStruct) {
      videoData = json.props.pageProps.itemInfo.itemStruct;
    }

    if (!videoData) {
      return res.status(200).json({ code: 2, message: "Không lấy được videoData" });
    }

    const playUrl = videoData.video?.playAddr;
    const downloadUrl = videoData.video?.downloadAddr;
    const music = videoData.music?.playUrl;

    const list = [
      ...(playUrl ? [{ url: playUrl, label: "Tải không watermark" }] : []),
      ...(downloadUrl ? [{ url: downloadUrl, label: "Tải (watermark)" }] : []),
      ...(music ? [{ url: music, label: "Tải nhạc" }] : [])
    ];

    if (list.length === 0) {
      return res.status(200).json({ code: 2, message: "Không tìm thấy video!" });
    }

    return res.status(200).json({
      code: 0,
      data: list,
      meta: {
        id: videoData.id,
        desc: videoData.desc,
        cover: videoData.video?.cover,
        author: videoData.author
      }
    });
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    return res.status(500).json({ code: 500, message: "Lỗi server", error: err.message });
  }
};


