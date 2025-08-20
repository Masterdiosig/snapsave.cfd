import axios from "axios";

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send("Thiếu URL");

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');
    res.setHeader("Content-Type", "application/octet-stream");

    response.data.pipe(res);
  } catch (err) {
    console.error("Lỗi tải:", err.message);
    res.status(500).send("Không tải được video.");
  }
}
