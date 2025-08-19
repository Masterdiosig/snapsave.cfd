const menuBtn = document.querySelector('.menu');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
menuBtn.addEventListener('click', () => { sidebar.classList.toggle('active'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); });

document.querySelectorAll('.faq-question').forEach(btn=>{
  btn.addEventListener('click',()=>btn.parentElement.classList.toggle('active'));
});
document.getElementById('y').textContent = new Date().getFullYear();

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("hf_urli");
  const resultBox = document.getElementById("result");
  const meta = document.getElementById("meta");
  const thumb = document.getElementById("thumb");
  const desc = document.getElementById("desc");
  const author = document.getElementById("author");

  function showErrorInline(message) {
    const box = document.getElementById("error-inline");
    const msg = document.getElementById("error-inline-msg");
    msg.textContent = message;
    box.style.display = "block";
    setTimeout(() => { box.style.display = "none"; }, 3000);
  }

  document.querySelectorAll(".sample").forEach(b=>{
    b.addEventListener("click",()=>{
      input.value = b.dataset.url;
      document.getElementById("submit").click();
    });
  });

  document.getElementById("download-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const tiktokUrl = input.value.trim();
    if (!tiktokUrl) { showErrorInline("Dán link TikTok hợp lệ!"); input.focus(); return; }

    try {
      const res = await fetch('/api/tiktok', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (window.API_TOKEN || 'my_super_secret_token_123')
        },
        body: JSON.stringify({ url: tiktokUrl })
      });

      const data = await res.json();
      if (data.code === 0 && data.data.length > 0) {
        // meta
        if (data.meta?.thumbnail) thumb.src = data.meta.thumbnail;
        desc.textContent = data.meta?.description || '';
        author.textContent = data.meta?.author ? ('Tác giả: ' + data.meta.author) : '';
        meta.style.display = 'flex';

        resultBox.innerHTML = '';
        for (const item of data.data) {
          const btn = document.createElement("button");
          btn.textContent = item.label;
          btn.onclick = async () => {
            try {
              const response = await fetch(`/api/download?url=${encodeURIComponent(item.url)}`);
              const blob = await response.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = "tiktok-video.mp4";
              document.body.appendChild(a);
              a.click();
              a.remove();
            } catch (err) {
              console.error("Lỗi tải video:", err);
              showErrorInline("Không tải được video.");
            }
          };
          resultBox.appendChild(btn);
        }
      } else {
        meta.style.display = 'none';
        resultBox.innerHTML = '';
        showErrorInline(data.message || "Không tìm thấy video!");
      }
    } catch (error) {
      console.error("Lỗi gọi API:", error);
      showErrorInline("Lỗi kết nối máy chủ!");
    }
  });
});
