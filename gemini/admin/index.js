import { db, auth, CLOUDINARY_CONFIG } from "../js/firebase-config.js";
import { 
  collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  onAuthStateChanged, signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 状態管理
let countries = [];
let allPosts = [];
let mediaRows = [];
let editPostId = null;
let editCountryId = null;
let deletedMediaUrls = [];

const $ = id => document.getElementById(id);

// --- 認証フロー ---
onAuthStateChanged(auth, user => {
  if (user) {
    $("login-screen").style.display = "none";
    $("admin-main").style.display = "block";
    $("header-user").style.display = "flex";
    $("user-email").textContent = user.email;
    loadAll();
  } else {
    $("login-screen").style.display = "block";
    $("admin-main").style.display = "none";
    $("header-user").style.display = "none";
  }
});

window.addEventListener('load', () => {
  $("btn-login").onclick = async () => {
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    $("login-error").textContent = "";
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      $("login-error").textContent = "ログインに失敗しました。";
    }
  };

  $("login-password").onkeydown = (e) => {
    if (e.key === "Enter") $("btn-login").click();
  };

  $("btn-logout").onclick = () => signOut(auth);

  // --- タブ切り替え ---
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      const tabId = `tab-${btn.dataset.tab}`;
      $(tabId).classList.add("active");

      if (btn.dataset.tab === "post-list") renderPostList();
      if (btn.dataset.tab === "country-mgmt") renderCountryList();
    };
  });

  $("btn-add-media-bottom").onclick = () => {
    mediaRows.push({ url: "", type: "image", caption: "", isCover: false });
    renderMediaList();
  };

  $("btn-submit-post").onclick = async () => {
    const countryId = $("f-country").value;
    const date = $("f-date").value;
    const title = $("f-title").value.trim();

    if (!countryId || !date || !title) {
      showToast("国、日付、タイトルは必須です。", true);
      return;
    }

    const postData = {
      countryId,
      date,
      title,
      location: $("f-location").value.trim(),
      caption: $("f-caption").value.trim(),
      media: mediaRows.map(r => ({ url: r.url, type: r.type, caption: r.caption, isCover: r.isCover })),
      updatedAt: serverTimestamp()
    };

    try {
      if (editPostId) {
        await updateDoc(doc(db, "posts", editPostId), postData);
        showToast("投稿を更新しました。");
      } else {
        postData.createdAt = serverTimestamp();
        await addDoc(collection(db, "posts"), postData);
        showToast("投稿を追加しました。");
      }
      resetPostForm();
      await loadPosts();
    } catch (err) {
      console.error(err);
      showToast("保存に失敗しました。", true);
    }
  };

  $("btn-cancel-post").onclick = () => resetPostForm();

  $("btn-submit-country").onclick = async () => {
    const name = $("c-name").value.trim();
    const flag = $("c-flag").value.trim();
    const order = Number($("c-order").value) || 100;
    const subtitle = $("c-subtitle").value.trim();
    const description = $("c-description").value.trim();

    if (!name) {
      showToast("国名は必須項目です。", true);
      return;
    }

    const cData = { name, flag, order, subtitle, description };

    try {
      if (editCountryId) {
        await updateDoc(doc(db, "countries", editCountryId), cData);
        showToast("国情報を更新しました。");
      } else {
        await addDoc(collection(db, "countries"), cData);
        showToast("国を追加しました。");
      }
      resetCountryForm();
      await loadCountries();
      renderCountryList();
    } catch (err) {
      console.error(err);
      showToast("国情報の保存に失敗しました。", true);
    }
  };

  $("btn-cancel-country").onclick = () => resetCountryForm();
});

// --- データロードコア ---
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  renderCountrySelect();
}

async function loadPosts() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  allPosts = [];
  snap.forEach(d => allPosts.push({ id: d.id, ...d.data() }));
}

// --- 新規投稿：国セレクト生成 ---
function renderCountrySelect() {
  const select = $("f-country");
  if(!select) return;
  select.innerHTML = "";
  countries.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.flag || ''} ${c.name}`;
    select.appendChild(opt);
  });
}

// --- メディア行レンダリング ---
function renderMediaList() {
  const container = $("media-list");
  container.innerHTML = "";

  mediaRows.forEach((row, idx) => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "media-row";

    // 削除ボタン
    const btnRemove = document.createElement("button");
    btnRemove.className = "btn-remove-media";
    btnRemove.textContent = "×";
    btnRemove.onclick = () => {
      if (editPostId && mediaRows[idx].url) {
        deletedMediaUrls.push(mediaRows[idx].url);
      }
      mediaRows.splice(idx, 1);
      renderMediaList();
    };
    rowDiv.appendChild(btnRemove);

    const header = document.createElement("div");
    header.className = "media-row-header";

    // プレビュー
    const previewWrap = document.createElement("div");
    previewWrap.className = "preview-wrap";
    updatePreview(previewWrap, row);
    header.appendChild(previewWrap);

    // フィールド群
    const fields = document.createElement("div");
    fields.className = "media-row-fields";

    const inputUrl = document.createElement("input");
    inputUrl.type = "url";
    inputUrl.className = "m-url";
    inputUrl.placeholder = "メディア URL";
    inputUrl.value = row.url || "";
    inputUrl.oninput = (e) => {
      row.url = e.target.value.trim();
      updatePreview(previewWrap, row);
    };
    fields.appendChild(inputUrl);

    const selectType = document.createElement("select");
    selectType.className = "m-type";
    selectType.innerHTML = `<option value="image">📷 写真</option><option value="video">🎬 動画</option>`;
    selectType.value = row.type || "image";
    selectType.onchange = (e) => {
      row.type = e.target.value;
      updatePreview(previewWrap, row);
    };
    fields.appendChild(selectType);

    const txtCaption = document.createElement("textarea");
    txtCaption.className = "m-caption";
    txtCaption.placeholder = "メディアのキャプション";
    txtCaption.rows = 2;
    txtCaption.value = row.caption || "";
    txtCaption.oninput = (e) => {
      row.caption = e.target.value;
    };
    fields.appendChild(txtCaption);

    header.appendChild(fields);
    rowDiv.appendChild(header);

    // コントロール行
    const controls = document.createElement("div");
    controls.className = "media-row-controls";

    const lblCover = document.createElement("label");
    lblCover.className = "cover-checkbox-label";
    lblCover.innerHTML = `<input type="checkbox" class="m-cover" ${row.isCover ? 'checked' : ''}> 代表写真`;
    lblCover.querySelector(".m-cover").onchange = (e) => {
      mediaRows.forEach(r => r.isCover = false);
      row.isCover = e.target.checked;
      renderMediaList();
    };
    controls.appendChild(lblCover);

    const btnUpload = document.createElement("button");
    btnUpload.type = "button";
    btnUpload.className = "btn-upload secondary-btn";
    btnUpload.style.padding = "2px 8px";
    btnUpload.style.fontSize = "11px";
    btnUpload.textContent = "☁️ アップロード";
    
    const progressSpan = document.createElement("span");
    progressSpan.className = "upload-progress";

    btnUpload.onclick = () => triggerCloudinaryUpload(idx, previewWrap, progressSpan, inputUrl);

    controls.appendChild(btnUpload);
    controls.appendChild(progressSpan);

    // 上下移動
    if (idx > 0) {
      const btnUp = document.createElement("button");
      btnUp.type = "button";
      btnUp.className = "secondary-btn";
      btnUp.style.padding = "2px 6px";
      btnUp.textContent = "↑";
      btnUp.onclick = () => {
        const temp = mediaRows[idx];
        mediaRows[idx] = mediaRows[idx - 1];
        mediaRows[idx - 1] = temp;
        renderMediaList();
      };
      controls.appendChild(btnUp);
    }
    if (idx < mediaRows.length - 1) {
      const btnDown = document.createElement("button");
      btnDown.type = "button";
      btnDown.className = "secondary-btn";
      btnDown.style.padding = "2px 6px";
      btnDown.textContent = "↓";
      btnDown.onclick = () => {
        const temp = mediaRows[idx];
        mediaRows[idx] = mediaRows[idx + 1];
        mediaRows[idx + 1] = temp;
        renderMediaList();
      };
      controls.appendChild(btnDown);
    }

    rowDiv.appendChild(controls);
    container.appendChild(rowDiv);

    // 挿入線
    const insertWrap = document.createElement("div");
    insertWrap.className = "insert-btn-wrap";
    const btnInsert = document.createElement("button");
    btnInsert.type = "button";
    btnInsert.className = "btn-insert";
    btnInsert.textContent = "＋ 行を挿入";
    btnInsert.onclick = () => {
      mediaRows.splice(idx + 1, 0, { url: "", type: "image", caption: "", isCover: false });
      renderMediaList();
    };
    insertWrap.appendChild(btnInsert);
    container.appendChild(insertWrap);
  });
}

function updatePreview(container, row) {
  container.innerHTML = "";
  if (!row.url) {
    container.textContent = "No media";
    return;
  }
  if (row.type === "video") {
    const video = document.createElement("video");
    video.src = row.url;
    video.muted = true;
    container.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = row.url;
    container.appendChild(img);
  }
}

// --- Cloudinary非同期アップロード ---
function triggerCloudinaryUpload(idx, previewContainer, progressEl, urlInput) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*,video/*";
  
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const resourceType = file.type.startsWith("video/") ? "video" : "image";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);

    progressEl.textContent = "アップロード中…";

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/\${CLOUDINARY_CONFIG.cloudName}/\${resourceType}/upload`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload Failed");
      const data = await res.json();

      mediaRows[idx].url = data.secure_url;
      mediaRows[idx].type = resourceType;
      
      urlInput.value = data.secure_url;
      renderMediaList();

      progressEl.textContent = "✓ アップロード完了";
      setTimeout(() => { progressEl.textContent = ""; }, 2000);

    } catch (err) {
      console.error(err);
      progressEl.textContent = "❌ 失敗しました";
    }
  };

  fileInput.click();
}

function resetPostForm() {
  $("f-date").value = "";
  $("f-title").value = "";
  $("f-location").value = "";
  $("f-caption").value = "";
  mediaRows = [];
  deletedMediaUrls = [];
  editPostId = null;
  renderMediaList();
  $("form-post-title").textContent = "新規投稿";
  $("btn-submit-post").textContent = "投稿する →";
  $("btn-cancel-post").style.display = "none";
}

// --- 投稿一覧レンダリング ---
function renderPostList() {
  const container = $("post-list-container");
  container.innerHTML = "";

  if (allPosts.length === 0) {
    container.innerHTML = "<p style='color:var(--muted); font-size:14px;'>投稿がありません。</p>";
    return;
  }

  allPosts.forEach(post => {
    const item = document.createElement("div");
    item.className = "post-list-item";

    // サムネイル選出
    let thumbUrl = "";
    let isVideoThumb = false;
    if (post.media && Array.isArray(post.media)) {
      let targetMedia = post.media.find(m => m.isCover && m.type === "image");
      if (!targetMedia) targetMedia = post.media.find(m => m.type === "image");
      if (!targetMedia && post.media.length > 0) targetMedia = post.media[0];
      
      if (targetMedia) {
        thumbUrl = targetMedia.url;
        isVideoThumb = targetMedia.type === "video";
      }
    }

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "preview-wrap";
    if (thumbUrl) {
      if (isVideoThumb) {
        const vid = document.createElement("video");
        vid.src = thumbUrl;
        vid.muted = true;
        thumbWrap.appendChild(vid);
      } else {
        const img = document.createElement("img");
        img.src = thumbUrl;
        thumbWrap.appendChild(img);
      }
    } else {
      thumbWrap.textContent = "📷";
    }
    item.appendChild(thumbWrap);

    // メタ情報
    const info = document.createElement("div");
    info.className = "post-info";
    
    const titleText = document.createElement("div");
    titleText.className = "post-title-text";
    titleText.textContent = post.title;
    info.appendChild(titleText);

    const targetCountry = countries.find(c => c.id === post.countryId);
    const countryName = targetCountry ? targetCountry.name : "不明な国";
    const mediaCount = post.media ? post.media.length : 0;
    const hasCover = post.media && post.media.some(m => m.isCover) ? " ／ ★代表写真あり" : "";

    const metaText = document.createElement("div");
    metaText.className = "post-meta-text";
    metaText.textContent = `\${countryName} ／ \${post.date} ／ 📎 \${mediaCount}件\${hasCover}`;
    info.appendChild(metaText);
    item.appendChild(info);

    // アクション
    const actions = document.createElement("div");
    actions.className = "post-actions";

    const btnEdit = document.createElement("button");
    btnEdit.className = "secondary-btn";
    btnEdit.style.padding = "4px 10px";
    btnEdit.style.fontSize = "12px";
    btnEdit.textContent = "編集";
    btnEdit.onclick = () => editPost(post);
    
    const btnDel = document.createElement("button");
    btnDel.className = "secondary-btn";
    btnDel.style.padding = "4px 10px";
    btnDel.style.fontSize = "12px";
    btnDel.textContent = "削除";
    btnDel.onclick = () => deletePost(post.id);

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);
    item.appendChild(actions);

    container.appendChild(item);
  });
}

function editPost(post) {
  editPostId = post.id;
  $("f-country").value = post.countryId;
  $("f-date").value = post.date;
  $("f-title").value = post.title;
  $("f-location").value = post.location || "";
  $("f-caption").value = post.caption || "";
  
  mediaRows = post.media ? JSON.parse(JSON.stringify(post.media)) : [];
  deletedMediaUrls = [];
  renderMediaList();

  $("form-post-title").textContent = "投稿の編集";
  $("btn-submit-post").textContent = "更新する →";
  $("btn-cancel-post").style.display = "inline-block";

  // タブを新規投稿に切り替え
  const tabBtn = document.querySelector('.tab-btn[data-tab="new-post"]');
  tabBtn.click();
}

async function deletePost(id) {
  if (!confirm("本当にこの投稿を削除しますか？")) return;
  try {
    await deleteDoc(doc(db, "posts", id));
    showToast("投稿を削除しました。");
    await loadPosts();
    renderPostList();
  } catch (err) {
    console.error(err);
    showToast("削除に失敗しました。", true);
  }
}

function resetCountryForm() {
  editCountryId = null;
  $("edit-country-id").value = "";
  $("c-name").value = "";
  $("c-flag").value = "";
  $("c-order").value = "100";
  $("c-subtitle").value = "";
  $("c-description").value = "";
  $("form-country-title").textContent = "国の追加";
  $("btn-cancel-country").style.display = "none";
}

function renderCountryList() {
  const container = $("country-list-container");
  container.innerHTML = "";

  // 国ごとの投稿数を集計
  const postCounts = {};
  allPosts.forEach(p => {
    if (p.countryId) postCounts[p.countryId] = (postCounts[p.countryId] || 0) + 1;
  });

  countries.forEach(c => {
    const item = document.createElement("div");
    item.className = "country-list-item";

    const flagEl = document.createElement("div");
    flagEl.style.fontSize = "24px";
    flagEl.textContent = c.flag || "🏳️";
    item.appendChild(flagEl);

    const info = document.createElement("div");
    info.className = "country-list-info";
    info.innerHTML = `
      <div style="font-weight:bold;">\${c.name}</div>
      <div style="font-size:12px; color:var(--muted); margin-top:2px;">
        表示順: \${c.order} ／ 投稿: \${postCounts[c.id] || 0}件
      </div>
    `;
    item.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "country-actions";

    const btnEdit = document.createElement("button");
    btnEdit.className = "secondary-btn";
    btnEdit.style.padding = "4px 10px";
    btnEdit.style.fontSize = "12px";
    btnEdit.textContent = "編集";
    btnEdit.onclick = () => {
      editCountryId = c.id;
      $("edit-country-id").value = c.id;
      $("c-name").value = c.name;
      $("c-flag").value = c.flag || "";
      $("c-order").value = c.order;
      $("c-subtitle").value = c.subtitle || "";
      $("c-description").value = c.description || "";
      $("form-country-title").textContent = "国の編集";
      $("btn-cancel-country").style.display = "inline-block";
    };

    const btnDel = document.createElement("button");
    btnDel.className = "secondary-btn";
    btnDel.style.padding = "4px 10px";
    btnDel.style.fontSize = "12px";
    btnDel.textContent = "削除";
    
    // 投稿が1件以上あれば disabled化
    if ((postCounts[c.id] || 0) > 0) {
      btnDel.disabled = true;
      btnDel.style.opacity = "0.4";
      btnDel.style.cursor = "not-allowed";
    } else {
      btnDel.onclick = async () => {
        if (!confirm(`本当に「\${c.name}」を削除しますか？`)) return;
        try {
          await deleteDoc(doc(db, "countries", c.id));
          showToast("国を削除しました。");
          await loadCountries();
          renderCountryList();
        } catch (err) {
          console.error(err);
          showToast("国の削除に失敗しました。", true);
        }
      };
    }

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);
    item.appendChild(actions);

    container.appendChild(item);
  });
}

// --- トースト通知 ---
function showToast(msg, isError = false) {
  const toast = $("toast");
  toast.textContent = msg;
  if (isError) toast.add("error");
  else toast.classList.remove("error");

  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
