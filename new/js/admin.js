// admin.js — 管理画面ロジック

import { db, auth, CLOUDINARY_CONFIG } from "../js/firebase-config.js";
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ===== AUTH =====
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-main').style.display = 'block';
    document.getElementById('logout-btn').style.display = 'inline-block';
    document.getElementById('admin-user').textContent = user.email;
    initAdmin();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-main').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
  }
});

window.doLogin = async function() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errEl.textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
  }
};

window.adminLogout = async function() {
  await signOut(auth);
};

// ===== INIT =====
async function initAdmin() {
  await loadCountrySelect();
  await loadPostsList();
  await loadCountriesList();
  resetPostForm();
  document.getElementById('post-date').value = new Date().toISOString().slice(0, 10);
}

// ===== TAB SWITCHING =====
window.switchAdminTab = function(tab) {
  document.querySelectorAll('.admin-tab').forEach((b, i) => {
    const tabs = ['post', 'posts', 'countries'];
    b.classList.toggle('active', tabs[i] === tab);
  });
  ['post', 'posts', 'countries'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
};

// ===== COUNTRY SELECT =====
async function loadCountrySelect() {
  const sel = document.getElementById('post-country');
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  sel.innerHTML = '<option value="">国を選択...</option>';
  snap.forEach(d => {
    const c = d.data();
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${c.flag} ${c.name}`;
    sel.appendChild(opt);
  });
}

// ===== MEDIA ROWS =====
let mediaRowCount = 0;

window.addMediaRow = function(data = null) {
  const idx = mediaRowCount++;
  const container = document.getElementById('media-rows');
  const row = document.createElement('div');
  row.className = 'media-row';
  row.id = `media-row-${idx}`;

  const urlVal     = data?.url     || '';
  const typeVal    = data?.type    || 'image';
  const captionVal = data?.caption || '';

  row.innerHTML = `
    <div class="media-row-header">
      <div class="media-row-label">メディア ${idx + 1}</div>
      <button class="remove-media-btn" onclick="removeMediaRow(${idx})">×</button>
    </div>

    <!-- Cloudinaryアップロード or URL入力 -->
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button class="add-media-btn" onclick="cloudinaryUpload(${idx})" style="flex:1">
        ☁️ Cloudinaryにアップロード
      </button>
    </div>

    <div class="media-row-inner">
      <div>
        <div class="form-label" style="margin-bottom:4px">または URLを直接入力</div>
        <div style="display:flex;gap:6px">
          <input type="url" class="form-input" id="media-url-${idx}"
            placeholder="https://res.cloudinary.com/..." value="${urlVal}"
            oninput="previewMedia(${idx})">
          <select class="form-select media-type-select" id="media-type-${idx}" onchange="previewMedia(${idx})">
            <option value="image" ${typeVal==='image'?'selected':''}>写真</option>
            <option value="video" ${typeVal==='video'?'selected':''}>動画</option>
          </select>
        </div>
      </div>
    </div>

    <!-- プレビュー -->
    <div id="media-preview-${idx}" style="margin-top:8px"></div>

    <div class="form-group" style="margin-top:10px;margin-bottom:0">
      <label class="form-label">このメディアのキャプション</label>
      <textarea class="form-textarea" id="media-caption-${idx}" style="min-height:60px"
        placeholder="写真・動画の説明...">${captionVal}</textarea>
    </div>
  `;

  container.appendChild(row);

  if (urlVal) previewMedia(idx);
};

window.removeMediaRow = function(idx) {
  const row = document.getElementById(`media-row-${idx}`);
  if (row) row.remove();
};

window.previewMedia = function(idx) {
  const url  = document.getElementById(`media-url-${idx}`)?.value?.trim();
  const type = document.getElementById(`media-type-${idx}`)?.value;
  const prev = document.getElementById(`media-preview-${idx}`);
  if (!prev) return;
  if (!url) { prev.innerHTML = ''; return; }

  if (type === 'image') {
    prev.innerHTML = `<img src="${url}" class="media-preview-thumb" onerror="this.style.display='none'">`;
  } else {
    prev.innerHTML = `<video src="${url}" class="media-preview-thumb" controls muted style="max-height:120px"></video>`;
  }
};

// ===== CLOUDINARY UPLOAD =====
window.cloudinaryUpload = async function(idx) {
  const { cloudName, uploadPreset } = CLOUDINARY_CONFIG;

  if (cloudName === 'YOUR_CLOUD_NAME') {
    showToast('firebase-config.js のCloudinary設定を入力してください', true);
    return;
  }

  // ファイル選択ダイアログ
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    showToast('アップロード中...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('resource_type', isVideo ? 'video' : 'image');

      const resourceType = isVideo ? 'video' : 'image';
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();

      if (data.secure_url) {
        document.getElementById(`media-url-${idx}`).value = data.secure_url;
        document.getElementById(`media-type-${idx}`).value = isVideo ? 'video' : 'image';
        previewMedia(idx);
        showToast('アップロード完了！');
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (e) {
      showToast('アップロードに失敗しました: ' + e.message, true);
      console.error(e);
    }
  };

  input.click();
};

// ===== POST SUBMIT =====
window.submitPost = async function() {
  const countryId = document.getElementById('post-country').value;
  const title     = document.getElementById('post-title').value.trim();
  const date      = document.getElementById('post-date').value;
  const location  = document.getElementById('post-location').value.trim();
  const caption   = document.getElementById('post-caption').value.trim();
  const editId    = document.getElementById('edit-post-id').value;

  if (!countryId || !title || !date) {
    showToast('国・タイトル・日付は必須です', true);
    return;
  }

  // メディア収集
  const media = [];
  document.querySelectorAll('.media-row').forEach(row => {
    const idx = row.id.replace('media-row-', '');
    const url     = document.getElementById(`media-url-${idx}`)?.value?.trim();
    const type    = document.getElementById(`media-type-${idx}`)?.value;
    const mcaption = document.getElementById(`media-caption-${idx}`)?.value?.trim() || '';
    if (url) media.push({ url, type, caption: mcaption });
  });

  const postData = { countryId, title, date, location, caption, media, updatedAt: serverTimestamp() };

  try {
    if (editId) {
      await updateDoc(doc(db, 'posts', editId), postData);
      showToast('投稿を更新しました');
    } else {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿しました！');
    }
    resetPostForm();
    await loadPostsList();
    switchAdminTab('posts');
  } catch (e) {
    showToast('保存に失敗しました', true);
    console.error(e);
  }
};

window.resetPostForm = function() {
  document.getElementById('edit-post-id').value = '';
  document.getElementById('post-country').value = '';
  document.getElementById('post-title').value = '';
  document.getElementById('post-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('post-location').value = '';
  document.getElementById('post-caption').value = '';
  document.getElementById('media-rows').innerHTML = '';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  mediaRowCount = 0;
  addMediaRow(); // 最初の1行
};

// ===== POSTS LIST =====
async function loadPostsList() {
  const container = document.getElementById('admin-posts-list');
  container.innerHTML = '<div class="loading-state">読み込み中...</div>';

  const [postsSnap, countriesSnap] = await Promise.all([
    getDocs(query(collection(db, 'posts'), orderBy('date', 'desc'))),
    getDocs(collection(db, 'countries'))
  ]);

  const countryMap = {};
  countriesSnap.forEach(d => { countryMap[d.id] = d.data(); });

  container.innerHTML = '';
  if (postsSnap.empty) {
    container.innerHTML = '<div class="loading-state">投稿がありません</div>';
    return;
  }

  postsSnap.forEach(d => {
    const post = { id: d.id, ...d.data() };
    const country = countryMap[post.countryId] || {};
    const item = document.createElement('div');
    item.className = 'admin-post-item';
    item.innerHTML = `
      <div class="admin-post-info">
        <div class="admin-post-title">${post.title}</div>
        <div class="admin-post-meta">
          ${country.flag || ''} ${country.name || post.countryId} · ${formatDate(post.date)} · ${(post.media||[]).length} メディア
        </div>
      </div>
      <div class="admin-post-actions">
        <button class="edit-btn" onclick="editPost('${post.id}')">編集</button>
        <button class="delete-btn" onclick="deletePost('${post.id}', '${post.title}')">削除</button>
      </div>
    `;
    container.appendChild(item);
  });
}

window.editPost = async function(postId) {
  const d = await getDoc(doc(db, 'posts', postId));
  const post = { id: d.id, ...d.data() };

  document.getElementById('edit-post-id').value = post.id;
  document.getElementById('post-country').value = post.countryId;
  document.getElementById('post-title').value   = post.title;
  document.getElementById('post-date').value    = post.date;
  document.getElementById('post-location').value = post.location || '';
  document.getElementById('post-caption').value  = post.caption || '';

  // メディア行リセットして再構築
  document.getElementById('media-rows').innerHTML = '';
  mediaRowCount = 0;
  (post.media || []).forEach(m => addMediaRow(m));
  if ((post.media || []).length === 0) addMediaRow();

  document.getElementById('cancel-edit-btn').style.display = 'inline-block';
  switchAdminTab('post');
  window.scrollTo(0, 0);
  showToast('編集モード');
};

window.deletePost = async function(postId, title) {
  if (!confirm(`「${title}」を削除しますか？`)) return;
  try {
    await deleteDoc(doc(db, 'posts', postId));
    showToast('削除しました');
    await loadPostsList();
  } catch (e) {
    showToast('削除に失敗しました', true);
    console.error(e);
  }
};

// ===== COUNTRIES =====
window.submitCountry = async function() {
  const name    = document.getElementById('country-name').value.trim();
  const flag    = document.getElementById('country-flag').value.trim();
  const order   = parseInt(document.getElementById('country-order').value) || 0;
  const editId  = document.getElementById('edit-country-id').value;

  if (!name || !flag) { showToast('国名と国旗絵文字は必須です', true); return; }

  const data = { name, flag, order };
  try {
    if (editId) {
      await updateDoc(doc(db, 'countries', editId), data);
      showToast('更新しました');
    } else {
      await addDoc(collection(db, 'countries'), data);
      showToast('追加しました');
    }
    resetCountryForm();
    await loadCountriesList();
    await loadCountrySelect();
  } catch (e) {
    showToast('保存に失敗しました', true);
    console.error(e);
  }
};

window.resetCountryForm = function() {
  document.getElementById('edit-country-id').value = '';
  document.getElementById('country-name').value = '';
  document.getElementById('country-flag').value = '';
  document.getElementById('country-order').value = '0';
  document.getElementById('cancel-country-btn').style.display = 'none';
};

async function loadCountriesList() {
  const container = document.getElementById('countries-list');
  const [countriesSnap, postsSnap] = await Promise.all([
    getDocs(query(collection(db, 'countries'), orderBy('order', 'asc'))),
    getDocs(collection(db, 'posts'))
  ]);

  const countMap = {};
  postsSnap.forEach(d => {
    const cid = d.data().countryId;
    countMap[cid] = (countMap[cid] || 0) + 1;
  });

  container.innerHTML = '';
  countriesSnap.forEach(d => {
    const c = { id: d.id, ...d.data() };
    const item = document.createElement('div');
    item.className = 'country-admin-item';
    item.innerHTML = `
      <div class="country-admin-flag">${c.flag}</div>
      <div class="country-admin-name">${c.name}</div>
      <div class="country-admin-count">${countMap[c.id] || 0} 投稿 · 順序: ${c.order}</div>
      <div class="admin-post-actions">
        <button class="edit-btn" onclick="editCountry('${c.id}', '${c.name}', '${c.flag}', ${c.order})">編集</button>
        <button class="delete-btn" onclick="deleteCountry('${c.id}', '${c.name}')">削除</button>
      </div>
    `;
    container.appendChild(item);
  });
}

window.editCountry = function(id, name, flag, order) {
  document.getElementById('edit-country-id').value = id;
  document.getElementById('country-name').value  = name;
  document.getElementById('country-flag').value  = flag;
  document.getElementById('country-order').value = order;
  document.getElementById('cancel-country-btn').style.display = 'inline-block';
};

window.deleteCountry = async function(id, name) {
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('countryId', '==', id)));
  if (!postsSnap.empty) {
    alert(`「${name}」には ${postsSnap.size} 件の投稿があるため削除できません。先に投稿を削除してください。`);
    return;
  }
  if (!confirm(`「${name}」を削除しますか？`)) return;
  await deleteDoc(doc(db, 'countries', id));
  showToast('削除しました');
  await loadCountriesList();
  await loadCountrySelect();
};

// ===== UTILS =====
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日`;
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
