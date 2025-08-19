import axios from "axios";

export default async function handler(req, res) {
  const { url } = req.query || {};
  if (!url) return res.status(400).send("Thiếu URL");

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
        "Referer": "https://www.tiktok.com/"
      },
      timeout: 20000,
      maxRedirects: 5
    });

    res.setHeader("Content-Disposition", 'attachment; filename="tiktok-video.mp4"');
    res.setHeader("Content-Type", "application/octet-stream");
    response.data.pipe(res);
  } catch (err) {
    console.error("Download error:", err?.response?.status, err?.message);
    res.status(500).send("Không tải được video.");
  }
}
