import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ========== 状態 ==========
let countries = [];
let allPosts = [];
let mediaRows = [];
let editPostId = null;
let editCountryId = null;
let deletedMediaUrls = [];

// ========== DOM ユーティリティ ==========
const $ = id => document.getElementById(id);

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========== トースト ==========
function showToast(msg, isError = false) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== 認証 ==========
onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').style.display = 'none';
    $('admin-main').style.display = '';
    $('header-user').style.display = '';
    $('header-email').textContent = user.email;
    loadAll();
  } else {
    $('login-screen').style.display = '';
    $('admin-main').style.display = 'none';
    $('header-user').style.display = 'none';
  }
});

$('btn-login').addEventListener('click', doLogin);
$('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

async function doLogin() {
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  $('login-error').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    $('login-error').textContent = 'ログインに失敗しました。';
  }
}

$('btn-logout').addEventListener('click', () => signOut(auth));

// ========== タブ切り替え ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tabId = 'tab-' + btn.dataset.tab;
    $(tabId).classList.add('active');

    if (btn.dataset.tab === 'post-list') renderPostList();
    if (btn.dataset.tab === 'country-mgmt') renderCountryList();
  });
});

// ========== データロード ==========
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  renderCountrySelect();
  renderCountryList();
}

async function loadPosts() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  allPosts = [];
  snap.forEach(d => allPosts.push({ id: d.id, ...d.data() }));
  renderPostList();
}

// ========== 国セレクト ==========
function renderCountrySelect() {
  const sel = $('f-country');
  const current = sel.value;
  sel.innerHTML = '<option value="">国を選択…</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.flag || ''} ${c.name}`.trim();
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

// ========== メディアリスト ==========
function renderMediaList() {
  const list = $('media-list');
  list.innerHTML = '';

  mediaRows.forEach((row, idx) => {
    // メディア行
    const div = document.createElement('div');
    div.className = 'media-row';
    div.innerHTML = `
      <button class="btn-remove-media" data-idx="${idx}" title="削除">×</button>
      <div class="media-row-header">
        <div class="preview-wrap" id="preview-${idx}">
          ${renderPreview(row)}
        </div>
        <div class="media-row-fields">
          <input type="url" class="m-url" placeholder="URL" value="${escHtml(row.url)}" data-idx="${idx}">
          <select class="m-type" data-idx="${idx}">
            <option value="image"${row.type === 'image' ? ' selected' : ''}>📷 写真</option>
            <option value="video"${row.type === 'video' ? ' selected' : ''}>🎬 動画</option>
          </select>
          <textarea class="m-caption" placeholder="キャプション（任意）" data-idx="${idx}">${escHtml(row.caption)}</textarea>
        </div>
      </div>
      <div class="media-row-controls">
        <label class="cover-checkbox-label">
          <input type="checkbox" class="m-cover" data-idx="${idx}"${row.isCover ? ' checked' : ''}>
          <span>★ 代表写真</span>
        </label>
        <button class="btn-upload" data-idx="${idx}">☁️ アップロード</button>
        <button class="btn-move" data-dir="up" data-idx="${idx}">↑</button>
        <button class="btn-move" data-dir="down" data-idx="${idx}">↓</button>
        <span class="upload-progress" id="progress-${idx}"></span>
      </div>
    `;
    list.appendChild(div);

    // 挿入ボタン（各行の下）
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    insertWrap.innerHTML = `<button class="btn-insert" data-pos="${idx + 1}">＋ ここに追加</button>`;
    list.appendChild(insertWrap);
  });

  // イベントバインド
  list.querySelectorAll('.m-url').forEach(el => {
    el.addEventListener('input', () => {
      const i = parseInt(el.dataset.idx);
      mediaRows[i].url = el.value;
      updatePreview(i);
    });
  });
  list.querySelectorAll('.m-type').forEach(el => {
    el.addEventListener('change', () => {
      const i = parseInt(el.dataset.idx);
      mediaRows[i].type = el.value;
      updatePreview(i);
    });
  });
  list.querySelectorAll('.m-caption').forEach(el => {
    el.addEventListener('input', () => {
      mediaRows[parseInt(el.dataset.idx)].caption = el.value;
    });
  });
  list.querySelectorAll('.m-cover').forEach(el => {
    el.addEventListener('change', () => {
      const i = parseInt(el.dataset.idx);
      if (el.checked) {
        mediaRows.forEach((r, ri) => r.isCover = ri === i);
        renderMediaList();
      } else {
        mediaRows[i].isCover = false;
      }
    });
  });
  list.querySelectorAll('.btn-remove-media').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.idx);
      if (editPostId && mediaRows[i].url) {
        deletedMediaUrls.push(mediaRows[i].url);
      }
      mediaRows.splice(i, 1);
      renderMediaList();
    });
  });
  list.querySelectorAll('.btn-upload').forEach(el => {
    el.addEventListener('click', () => uploadMedia(parseInt(el.dataset.idx)));
  });
  list.querySelectorAll('.btn-move').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.idx);
      const dir = el.dataset.dir;
      if (dir === 'up' && i > 0) {
        [mediaRows[i], mediaRows[i-1]] = [mediaRows[i-1], mediaRows[i]];
        renderMediaList();
      } else if (dir === 'down' && i < mediaRows.length - 1) {
        [mediaRows[i], mediaRows[i+1]] = [mediaRows[i+1], mediaRows[i]];
        renderMediaList();
      }
    });
  });
  list.querySelectorAll('.btn-insert').forEach(el => {
    el.addEventListener('click', () => {
      const pos = parseInt(el.dataset.pos);
      mediaRows.splice(pos, 0, { url: '', type: 'image', caption: '', isCover: false });
      renderMediaList();
    });
  });
}

function renderPreview(row) {
  if (!row.url) return '<span class="preview-no-media">No media</span>';
  if (row.type === 'video') {
    return `<video src="${escHtml(row.url)}" preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`;
  }
  return `<img src="${escHtml(row.url)}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
}

function updatePreview(idx) {
  const wrap = document.getElementById(`preview-${idx}`);
  if (wrap) wrap.innerHTML = renderPreview(mediaRows[idx]);
}

// ========== Cloudinary アップロード ==========
async function uploadMedia(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.click();
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const progressEl = document.getElementById(`progress-${idx}`);
    progressEl.textContent = 'アップロード中…';
    progressEl.className = 'upload-progress';

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (data.secure_url) {
        mediaRows[idx].url = data.secure_url;
        mediaRows[idx].type = resourceType === 'video' ? 'video' : 'image';
        renderMediaList();
        const prog = document.getElementById(`progress-${idx}`);
        if (prog) {
          prog.textContent = '✓ アップロード完了';
          prog.className = 'upload-progress success';
          setTimeout(() => { prog.textContent = ''; prog.className = 'upload-progress'; }, 2000);
        }
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (err) {
      progressEl.textContent = 'エラー: ' + err.message;
      progressEl.className = 'upload-progress error';
    }
  };
}

// ========== 投稿フォーム ==========
$('btn-add-media-bottom').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
});

$('btn-submit-post').addEventListener('click', submitPost);
$('btn-cancel-edit').addEventListener('click', resetPostForm);

async function submitPost() {
  const countryId = $('f-country').value;
  const date = $('f-date').value;
  const title = $('f-title').value.trim();

  if (!countryId) { showToast('国を選択してください。', true); return; }
  if (!date) { showToast('日付を入力してください。', true); return; }
  if (!title) { showToast('タイトルを入力してください。', true); return; }

  const data = {
    countryId,
    date,
    title,
    location: $('f-location').value.trim(),
    caption: $('f-caption').value.trim(),
    media: mediaRows.map(r => ({
      url: r.url,
      type: r.type,
      caption: r.caption,
      isCover: r.isCover
    })),
    updatedAt: serverTimestamp()
  };

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), data);
      showToast('投稿を更新しました。');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), data);
      showToast('投稿しました。');
    }
    resetPostForm();
    await loadPosts();
  } catch (err) {
    console.error(err);
    showToast('保存に失敗しました: ' + err.message, true);
  }
}

function resetPostForm() {
  editPostId = null;
  mediaRows = [];
  deletedMediaUrls = [];
  $('edit-post-id').value = '';
  $('f-country').value = '';
  $('f-date').value = '';
  $('f-title').value = '';
  $('f-location').value = '';
  $('f-caption').value = '';
  $('post-form-title').textContent = '新規投稿';
  $('btn-submit-post').textContent = '投稿する →';
  $('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}

function editPost(post) {
  editPostId = post.id;
  deletedMediaUrls = [];
  $('edit-post-id').value = post.id;
  $('f-country').value = post.countryId || '';
  $('f-date').value = post.date || '';
  $('f-title').value = post.title || '';
  $('f-location').value = post.location || '';
  $('f-caption').value = post.caption || '';
  mediaRows = (post.media || []).map(m => ({ ...m }));
  $('post-form-title').textContent = '投稿を編集';
  $('btn-submit-post').textContent = '更新する →';
  $('btn-cancel-edit').style.display = '';
  renderMediaList();

  // 新規投稿タブへ切り替え
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="new-post"]').classList.add('active');
  $('tab-new-post').classList.add('active');

  window.scrollTo(0, 0);
}

// ========== 投稿一覧 ==========
function renderPostList() {
  const container = $('post-list-container');

  if (allPosts.length === 0) {
    container.innerHTML = '<p class="empty-msg">投稿がありません。</p>';
    return;
  }

  let html = '';
  allPosts.forEach(post => {
    const countryObj = countries.find(c => c.id === post.countryId);
    const countryName = countryObj ? countryObj.name : post.countryId;
    const mediaCount = (post.media || []).length;
    const hasCover = (post.media || []).some(m => m.isCover);

    // サムネイル選出
    let thumbUrl = '';
    const coverMedia = (post.media || []).find(m => m.isCover && m.type === 'image');
    const firstImage = (post.media || []).find(m => m.type === 'image');
    if (coverMedia) thumbUrl = coverMedia.url;
    else if (firstImage) thumbUrl = firstImage.url;

    const thumbHtml = thumbUrl
      ? `<img class="post-thumb" src="${escHtml(thumbUrl)}" alt="">`
      : `<div class="post-thumb-placeholder">📷</div>`;

    const meta = `${escHtml(countryName)} ／ ${escHtml(post.date)} ／ 📎 ${mediaCount}件${hasCover ? ' ／ ★代表写真あり' : ''}`;

    html += `<div class="post-list-item" data-id="${escHtml(post.id)}">
      ${thumbHtml}
      <div class="post-info">
        <div class="post-title-text">${escHtml(post.title)}</div>
        <div class="post-meta-text">${meta}</div>
      </div>
      <div class="post-actions">
        <button class="btn-edit" data-id="${escHtml(post.id)}">編集</button>
        <button class="btn-delete" data-id="${escHtml(post.id)}">削除</button>
      </div>
    </div>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const post = allPosts.find(p => p.id === btn.dataset.id);
      if (post) editPost(post);
    });
  });
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('この投稿を削除しますか？')) return;
      try {
        await deleteDoc(doc(db, 'posts', btn.dataset.id));
        showToast('削除しました。');
        await loadPosts();
      } catch (err) {
        showToast('削除に失敗しました。', true);
      }
    });
  });
}

// ========== 国管理 ==========
$('btn-save-country').addEventListener('click', saveCountry);
$('btn-cancel-country').addEventListener('click', resetCountryForm);

async function saveCountry() {
  const name = $('c-name').value.trim();
  if (!name) { showToast('国名を入力してください。', true); return; }

  const data = {
    name,
    flag: $('c-flag').value.trim(),
    order: parseInt($('c-order').value) || 100,
    subtitle: $('c-subtitle').value.trim(),
    description: $('c-description').value.trim()
  };

  try {
    if (editCountryId) {
      await updateDoc(doc(db, 'countries', editCountryId), data);
      showToast('更新しました。');
    } else {
      await addDoc(collection(db, 'countries'), data);
      showToast('追加しました。');
    }
    resetCountryForm();
    await loadCountries();
  } catch (err) {
    showToast('保存に失敗しました。', true);
  }
}

function resetCountryForm() {
  editCountryId = null;
  $('edit-country-id').value = '';
  $('c-name').value = '';
  $('c-flag').value = '';
  $('c-order').value = '100';
  $('c-subtitle').value = '';
  $('c-description').value = '';
  $('country-form-title').textContent = '国・地域を追加';
  $('btn-cancel-country').style.display = 'none';
}

function renderCountryList() {
  const container = $('country-list-container');

  if (countries.length === 0) {
    container.innerHTML = '<p class="empty-msg">国データがありません。</p>';
    return;
  }

  // 国ごとの投稿数集計
  const postCount = {};
  allPosts.forEach(p => {
    if (p.countryId) postCount[p.countryId] = (postCount[p.countryId] || 0) + 1;
  });

  let html = '';
  countries.forEach(c => {
    const count = postCount[c.id] || 0;
    const deleteDisabled = count > 0 ? ' disabled' : '';
    html += `<div class="country-list-item" data-id="${escHtml(c.id)}">
      <div class="country-flag-icon">${escHtml(c.flag || '')}</div>
      <div class="country-list-info">
        <div class="country-list-name">${escHtml(c.name)}</div>
        <div class="country-list-meta">表示順: ${c.order} ／ 投稿: ${count}件</div>
      </div>
      <div class="country-list-actions">
        <button class="btn-edit" data-id="${escHtml(c.id)}">編集</button>
        <button class="btn-delete" data-id="${escHtml(c.id)}"${deleteDisabled}>削除</button>
      </div>
    </div>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = countries.find(c => c.id === btn.dataset.id);
      if (!c) return;
      editCountryId = c.id;
      $('edit-country-id').value = c.id;
      $('c-name').value = c.name || '';
      $('c-flag').value = c.flag || '';
      $('c-order').value = c.order ?? 100;
      $('c-subtitle').value = c.subtitle || '';
      $('c-description').value = c.description || '';
      $('country-form-title').textContent = '国・地域を編集';
      $('btn-cancel-country').style.display = '';
      window.scrollTo(0, 0);
    });
  });
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('この国を削除しますか？')) return;
      try {
        await deleteDoc(doc(db, 'countries', btn.dataset.id));
        showToast('削除しました。');
        await loadCountries();
      } catch (err) {
        showToast('削除に失敗しました。', true);
      }
    });
  });
}

// 初期描画
renderMediaList();
