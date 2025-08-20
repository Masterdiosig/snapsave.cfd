document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("hf_urli");
  const resultBox = document.getElementById("result");

  function showErrorInline(message) {
    const box = document.getElementById("error-inline");
    const msg = document.getElementById("error-inline-msg");
    msg.textContent = message;
    box.style.display = "block";
    setTimeout(() => {
      box.style.display = "none";
    }, 4000);
  }

  document.getElementById("submit").addEventListener("click", async (e) => {
    e.preventDefault();
    const tiktokUrl = input.value.trim();

    if (!tiktokUrl) {
      showErrorInline("Vui lòng dán link TikTok!");
      input.focus();
      return;
    }

    try {
      const res = await fetch('/api/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tiktokUrl })
      });

      const data = await res.json();
      resultBox.innerHTML = '';

      if (data.code === 0 && data.data.length > 0) {
        for (const item of data.data) {
          const btn = document.createElement("button");
          btn.textContent = item.label;
          btn.onclick = async () => {
            try {
              const response = await fetch(`/api/download?url=${encodeURIComponent(item.url)}`);
              const blob = await response.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = "tiktok.mp4";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } catch (err) {
              showErrorInline("Không tải được video.");
            }
          };
          resultBox.appendChild(btn);
        }
      } else {
        showErrorInline("Không tìm thấy video!");
      }
    } catch (error) {
      showErrorInline("Lỗi kết nối tới máy chủ!");
    }
  });
});
