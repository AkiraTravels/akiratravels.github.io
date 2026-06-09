import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── 状態 ──
let countries = [];
let allPosts = [];
let mediaRows = [];
let editPostId = null;
let editCountryId = null;
let deletedMediaUrls = [];

// ── ユーティリティ ──
const $ = id => document.getElementById(id);

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, isError = false) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── 認証 ──
onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').style.display = 'none';
    $('admin-main').style.display = 'block';
    $('header-user').style.display = 'flex';
    $('header-email').textContent = user.email;
    loadAll();
  } else {
    $('login-screen').style.display = 'block';
    $('admin-main').style.display = 'none';
    $('header-user').style.display = 'none';
  }
});

$('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('btn-login').click();
});

$('btn-login').addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  $('login-error').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    $('login-error').textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
  }
});

$('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
});

// ── データロード ──
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  renderCountrySelect();
  renderCountryList();
  renderListFilter();
}

async function loadPosts() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  allPosts = [];
  snap.forEach(d => allPosts.push({ id: d.id, ...d.data() }));
  renderPostList();
}

// ── タブ切り替え ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $(`tab-${tab}`).classList.add('active');
    if (tab === 'post-list') renderPostList();
    if (tab === 'country-mgmt') renderCountryList();
  });
});

// ── 国セレクト（新規投稿フォーム用） ──
function renderCountrySelect() {
  const sel = $('f-country');
  sel.innerHTML = '<option value="">国を選択…</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.flag || ''} ${c.name}`.trim();
    sel.appendChild(opt);
  });
}

// ── 投稿一覧フィルター ──
function renderListFilter() {
  const sel = $('list-country-filter');
  // 既存オプションをリセット（"すべての国"は残す）
  while (sel.options.length > 1) sel.remove(1);
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.flag || ''} ${c.name}`.trim();
    sel.appendChild(opt);
  });
}

$('list-country-filter').addEventListener('change', () => renderPostList());

// ── 投稿一覧 ──
function renderPostList() {
  const wrap = $('post-list-wrap');
  const selectedId = $('list-country-filter').value;
  const posts = selectedId
    ? allPosts.filter(p => p.countryId === selectedId)
    : allPosts;

  if (posts.length === 0) {
    wrap.innerHTML = '<p style="color:#8a7e74;font-size:13px;padding:12px 0;">投稿がありません。</p>';
    return;
  }

  wrap.innerHTML = posts.map(post => {
    const country = countries.find(c => c.id === post.countryId);
    const countryName = country ? country.name : '?';
    const media = post.media || [];
    const mediaCount = media.length;

    // サムネイル選出
    const coverImg = media.find(m => m.isCover && m.type === 'image')
      || media.find(m => m.type === 'image');
    const hasCover = media.some(m => m.isCover);

    const thumbHtml = coverImg
      ? `<img src="${escHtml(coverImg.url)}" alt="" loading="lazy">`
      : '<span>📷</span>';

    const metaText = `${escHtml(countryName)} ／ ${escHtml(post.date || '')} ／ 📎 ${mediaCount}件${hasCover ? ' ／ ★代表写真あり' : ''}`;

    return `<div class="post-list-item" data-id="${escHtml(post.id)}">
      <div class="post-thumb">${thumbHtml}</div>
      <div class="post-info">
        <div class="post-title-text">${escHtml(post.title)}</div>
        <div class="post-meta-text">${metaText}</div>
      </div>
      <div class="post-actions">
        <button class="btn-secondary btn-sm btn-edit-post" data-id="${escHtml(post.id)}">編集</button>
        <button class="btn-danger btn-sm btn-delete-post" data-id="${escHtml(post.id)}">削除</button>
      </div>
    </div>`;
  }).join('');

  // イベント
  wrap.querySelectorAll('.btn-edit-post').forEach(btn => {
    btn.addEventListener('click', () => {
      const post = allPosts.find(p => p.id === btn.dataset.id);
      if (post) editPost(post);
    });
  });
  wrap.querySelectorAll('.btn-delete-post').forEach(btn => {
    btn.addEventListener('click', () => deletePost(btn.dataset.id));
  });
}

// ── 投稿の編集 ──
function editPost(post) {
  // 新規投稿タブに切り替え
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="new-post"]').classList.add('active');
  $('tab-new-post').classList.add('active');

  // フィールドにロード
  editPostId = post.id;
  $('form-title').textContent = '投稿を編集';
  $('btn-submit').textContent = '更新する →';
  $('btn-cancel').style.display = '';

  $('f-country').value = post.countryId || '';
  $('f-date').value = post.date || '';
  $('f-title').value = post.title || '';
  $('f-location').value = post.location || '';
  $('f-caption').value = post.caption || '';

  mediaRows = (post.media || []).map(m => ({ ...m }));
  deletedMediaUrls = [];
  renderMediaList();
}

// ── 投稿の削除 ──
async function deletePost(id) {
  if (!confirm('この投稿を削除してもよいですか？')) return;
  try {
    await deleteDoc(doc(db, 'posts', id));
    showToast('投稿を削除しました。');
    await loadPosts();
  } catch (e) {
    showToast('削除に失敗しました。', true);
    console.error(e);
  }
}

// ── メディアリスト ──
function renderMediaList() {
  const list = $('media-list');
  list.innerHTML = '';

  mediaRows.forEach((row, idx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'media-row';

    // プレビュー
    let previewHtml = '<span style="font-size:11px;color:#8a7e74;">No media</span>';
    if (row.url) {
      if (row.type === 'video') {
        previewHtml = `<video src="${escHtml(row.url)}" preload="metadata"></video>`;
      } else {
        previewHtml = `<img src="${escHtml(row.url)}" alt="">`;
      }
    }

    const coverChecked = row.isCover ? 'checked' : '';

    rowEl.innerHTML = `
      <button class="btn-remove-media" data-idx="${idx}" title="削除">×</button>
      <div class="media-row-header">
        <div class="preview-wrap">${previewHtml}</div>
        <div class="media-row-fields">
          <input type="url" class="m-url" placeholder="https://..." value="${escHtml(row.url || '')}">
          <select class="m-type">
            <option value="image" ${row.type !== 'video' ? 'selected' : ''}>📷 写真</option>
            <option value="video" ${row.type === 'video' ? 'selected' : ''}>🎬 動画</option>
          </select>
          <textarea class="m-caption" rows="2" placeholder="キャプション（任意）">${escHtml(row.caption || '')}</textarea>
        </div>
      </div>
      <div class="media-row-controls">
        <label class="cover-checkbox-label">
          <input type="checkbox" class="m-cover" ${coverChecked}> ★ 代表写真
        </label>
        <button class="btn-upload">☁️ アップロード</button>
        <button class="btn-move" data-dir="up">↑</button>
        <button class="btn-move" data-dir="down">↓</button>
        <span class="upload-progress"></span>
      </div>
    `;

    list.appendChild(rowEl);

    // URL
    rowEl.querySelector('.m-url').addEventListener('input', e => {
      mediaRows[idx].url = e.target.value.trim();
      updatePreview(rowEl, mediaRows[idx]);
    });
    // type
    rowEl.querySelector('.m-type').addEventListener('change', e => {
      mediaRows[idx].type = e.target.value;
    });
    // caption
    rowEl.querySelector('.m-caption').addEventListener('input', e => {
      mediaRows[idx].caption = e.target.value;
    });
    // cover
    rowEl.querySelector('.m-cover').addEventListener('change', e => {
      mediaRows.forEach((r, i) => r.isCover = (i === idx && e.target.checked));
      renderMediaList();
    });
    // remove
    rowEl.querySelector('.btn-remove-media').addEventListener('click', () => {
      if (editPostId && mediaRows[idx].url) {
        deletedMediaUrls.push(mediaRows[idx].url);
      }
      mediaRows.splice(idx, 1);
      renderMediaList();
    });
    // upload
    rowEl.querySelector('.btn-upload').addEventListener('click', () => uploadMedia(idx));
    // move
    rowEl.querySelectorAll('.btn-move').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.dir;
        if (dir === 'up' && idx > 0) {
          [mediaRows[idx - 1], mediaRows[idx]] = [mediaRows[idx], mediaRows[idx - 1]];
          renderMediaList();
        } else if (dir === 'down' && idx < mediaRows.length - 1) {
          [mediaRows[idx], mediaRows[idx + 1]] = [mediaRows[idx + 1], mediaRows[idx]];
          renderMediaList();
        }
      });
    });

    // 挿入ボタン
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn-insert';
    insertBtn.dataset.pos = idx + 1;
    insertBtn.textContent = '＋ ここに追加';
    insertBtn.addEventListener('click', () => {
      const pos = parseInt(insertBtn.dataset.pos);
      mediaRows.splice(pos, 0, { url: '', type: 'image', caption: '', isCover: false });
      renderMediaList();
    });
    insertWrap.appendChild(insertBtn);
    list.appendChild(insertWrap);
  });
}

function updatePreview(rowEl, row) {
  const wrap = rowEl.querySelector('.preview-wrap');
  if (!row.url) {
    wrap.innerHTML = '<span style="font-size:11px;color:#8a7e74;">No media</span>';
    return;
  }
  if (row.type === 'video') {
    wrap.innerHTML = `<video src="${escHtml(row.url)}" preload="metadata"></video>`;
  } else {
    wrap.innerHTML = `<img src="${escHtml(row.url)}" alt="">`;
  }
}

// ── Cloudinary アップロード ──
async function uploadMedia(idx) {
  const rowEl = document.querySelectorAll('.media-row')[idx];
  const progressEl = rowEl.querySelector('.upload-progress');
  progressEl.textContent = 'アップロード中…';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) { progressEl.textContent = ''; return; }

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
        mediaRows[idx].type = resourceType;
        renderMediaList();
        const newRowEl = document.querySelectorAll('.media-row')[idx];
        const newProgress = newRowEl.querySelector('.upload-progress');
        newProgress.textContent = '✓ アップロード完了';
        setTimeout(() => { newProgress.textContent = ''; }, 2000);
      } else {
        progressEl.textContent = 'アップロードエラー';
      }
    } catch (e) {
      progressEl.textContent = 'アップロードに失敗しました';
      console.error(e);
    }
  };
}

// ── メディアを追加 ──
$('btn-add-media-bottom').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
});

// ── 投稿の保存 ──
$('btn-submit').addEventListener('click', () => submitPost());

async function submitPost() {
  const countryId = $('f-country').value;
  const date = $('f-date').value;
  const title = $('f-title').value.trim();

  if (!countryId) { showToast('国・地域を選択してください。', true); return; }
  if (!date)      { showToast('日付を入力してください。', true); return; }
  if (!title)     { showToast('タイトルを入力してください。', true); return; }

  const postData = {
    countryId,
    date,
    title,
    location: $('f-location').value.trim(),
    caption:  $('f-caption').value.trim(),
    media: mediaRows.map(r => ({
      url:     r.url || '',
      type:    r.type || 'image',
      caption: r.caption || '',
      isCover: r.isCover || false
    })),
    updatedAt: serverTimestamp()
  };

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      showToast('投稿を更新しました。');
    } else {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿しました。');
    }
    resetPostForm();
    await loadPosts();
  } catch (e) {
    showToast('保存に失敗しました。', true);
    console.error(e);
  }
}

// ── フォームリセット ──
function resetPostForm() {
  editPostId = null;
  mediaRows = [];
  deletedMediaUrls = [];
  $('form-title').textContent = '新規投稿';
  $('btn-submit').textContent = '投稿する →';
  $('btn-cancel').style.display = 'none';
  $('f-country').value = '';
  $('f-date').value = '';
  $('f-title').value = '';
  $('f-location').value = '';
  $('f-caption').value = '';
  renderMediaList();
}

$('btn-cancel').addEventListener('click', () => {
  if (confirm('編集をキャンセルしますか？')) resetPostForm();
});

// ── 国管理 ──
function renderCountryList() {
  const wrap = $('country-list-wrap');

  // 投稿数マップ
  const countMap = {};
  allPosts.forEach(p => {
    if (p.countryId) countMap[p.countryId] = (countMap[p.countryId] || 0) + 1;
  });

  if (countries.length === 0) {
    wrap.innerHTML = '<p style="color:#8a7e74;font-size:13px;padding:12px 0;">国がまだ登録されていません。</p>';
    return;
  }

  wrap.innerHTML = countries.map(c => {
    const count = countMap[c.id] || 0;
    const canDelete = count === 0;
    return `<div class="country-list-item" data-id="${escHtml(c.id)}">
      <div class="country-flag-display">${escHtml(c.flag || '')}</div>
      <div class="country-list-info">
        <div class="c-name">${escHtml(c.name)}</div>
        <div class="c-meta">表示順: ${escHtml(String(c.order ?? ''))} ／ 投稿: ${count}件</div>
      </div>
      <div class="country-actions">
        <button class="btn-secondary btn-sm btn-edit-country" data-id="${escHtml(c.id)}">編集</button>
        <button class="btn-danger btn-sm btn-delete-country" data-id="${escHtml(c.id)}" ${canDelete ? '' : 'disabled'}>削除</button>
      </div>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.btn-edit-country').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = countries.find(x => x.id === btn.dataset.id);
      if (c) loadCountryForm(c);
    });
  });
  wrap.querySelectorAll('.btn-delete-country').forEach(btn => {
    btn.addEventListener('click', () => deleteCountry(btn.dataset.id));
  });
}

function loadCountryForm(c) {
  editCountryId = c.id;
  $('country-form-title').textContent = '国を編集';
  $('edit-country-id').value = c.id;
  $('c-name').value = c.name || '';
  $('c-flag').value = c.flag || '';
  $('c-order').value = c.order ?? 100;
  $('c-subtitle').value = c.subtitle || '';
  $('c-description').value = c.description || '';
  $('btn-cancel-country').style.display = '';
}

function resetCountryForm() {
  editCountryId = null;
  $('country-form-title').textContent = '国を追加';
  $('edit-country-id').value = '';
  $('c-name').value = '';
  $('c-flag').value = '';
  $('c-order').value = 100;
  $('c-subtitle').value = '';
  $('c-description').value = '';
  $('btn-cancel-country').style.display = 'none';
}

$('btn-save-country').addEventListener('click', async () => {
  const name = $('c-name').value.trim();
  if (!name) { showToast('国名を入力してください。', true); return; }

  const data = {
    name,
    flag:        $('c-flag').value.trim(),
    order:       parseInt($('c-order').value) || 100,
    subtitle:    $('c-subtitle').value.trim(),
    description: $('c-description').value.trim()
  };

  try {
    if (editCountryId) {
      await updateDoc(doc(db, 'countries', editCountryId), data);
      showToast('国を更新しました。');
    } else {
      await addDoc(collection(db, 'countries'), data);
      showToast('国を追加しました。');
    }
    resetCountryForm();
    await loadCountries();
  } catch (e) {
    showToast('保存に失敗しました。', true);
    console.error(e);
  }
});

$('btn-cancel-country').addEventListener('click', () => resetCountryForm());

async function deleteCountry(id) {
  if (!confirm('この国を削除してもよいですか？')) return;
  try {
    await deleteDoc(doc(db, 'countries', id));
    showToast('国を削除しました。');
    await loadCountries();
  } catch (e) {
    showToast('削除に失敗しました。', true);
    console.error(e);
  }
}
