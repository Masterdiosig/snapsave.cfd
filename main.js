async function fetchVideo(url) {
  try {
    showLoading(true);

    const response = await fetch("/api/tiktok", {
      method: "POST",
      headers: {
       'Content-Type': 'application/json',
          'Authorization': 'Bearer my_super_secret_token_123'
      },
      body: JSON.stringify({ url })
    });

    const result = await response.json();
    showLoading(false);

    if (result.code === 0 && result.data.length > 0) {
      // ✅ Có link tải
      renderResult(result.data, result.meta);
    } else if (result.code === 2) {
      // ⚠️ Fallback oEmbed: chỉ hiển thị thông tin
      renderMetaOnly(result.meta);
    } else {
      showError(result.message || "Không tìm thấy video!");
    }
  } catch (err) {
    console.error("❌ Fetch lỗi:", err);
    showLoading(false);
    showError("Lỗi kết nối tới máy chủ!");
  }
}

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
