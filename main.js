document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("hf_urli");
  const submitBtn = document.getElementById("submit");
  const resultBox = document.getElementById("result");
  const errorMsg = document.getElementById("error-inline-msg");

  submitBtn.addEventListener("click", async () => {
    const url = input.value.trim();
    resultBox.innerHTML = "";
    errorMsg.textContent = "";

    if (!url) {
      errorMsg.textContent = "⚠️ Vui lòng nhập link TikTok!";
      return;
    }

    try {
      const res = await fetch("/api/tiktok", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer my_super_secret_token_123" // ✅ Token khớp .env
        },
        body: JSON.stringify({ url })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        errorMsg.textContent = "❌ Lỗi: " + (data.error || "Không lấy được dữ liệu");
        return;
      }

      // ✅ Hiển thị kết quả
      if (data.data && data.data.length > 0) {
        data.data.forEach(item => {
          const a = document.createElement("a");
          a.href = `/api/download?url=${encodeURIComponent(item.url)}`;
          a.textContent = item.label;
          a.target = "_blank";
          a.className = "download-btn";
          resultBox.appendChild(a);
        });
      } else {
        errorMsg.textContent = "⚠️ Không tìm thấy link tải.";
      }

    } catch (err) {
      console.error("Lỗi fetch:", err);
      errorMsg.textContent = "❌ Kết nối thất bại!";
    }
  });
});


// ✅ Render khi có link tải
function renderResult(list, meta) {
  const container = document.getElementById("result");
  container.innerHTML = `
    <div class="video-meta">
      <img src="${meta.thumbnail || ""}" alt="Thumbnail"/>
      <p><strong>${meta.author || "Ẩn danh"}</strong></p>
      <p>${meta.description || ""}</p>
    </div>
    <div class="download-list">
      ${list
        .map(
          (item) => `
        <a href="/api/download?url=${encodeURIComponent(item.url)}" class="btn-download">
          ${item.label}
        </a>`
        )
        .join("")}
    </div>
  `;
}

// ✅ Render khi chỉ có meta (không có link tải)
function renderMetaOnly(meta) {
  const container = document.getElementById("result");
  container.innerHTML = `
    <div class="video-meta">
      <img src="${meta.thumbnail || ""}" alt="Thumbnail"/>
      <p><strong>${meta.author || "Ẩn danh"}</strong></p>
      <p>${meta.description || ""}</p>
    </div>
    <div class="warning">
      ❌ Không lấy được video để tải xuống, chỉ hiển thị thông tin.
    </div>
  `;
}
