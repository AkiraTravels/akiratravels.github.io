import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ===== 状態 =====
let countries = [];
let posts = [];
let mediaRows = [];
let editPostId = null;
let deletedMediaUrls = [];

// ===== 認証 =====
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-main').style.display = '';
    document.getElementById('header-user').style.display = 'flex';
    document.getElementById('header-email').textContent = user.email;
    loadAll();
  } else {
    document.getElementById('login-screen').style.display = '';
    document.getElementById('admin-main').style.display = 'none';
    document.getElementById('header-user').style.display = 'none';
  }
});

// ログイン
document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errEl.textContent = 'ログインに失敗しました: ' + err.message;
  }
}

// ログアウト
document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
});

// ===== データロード =====
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  updateCountrySelects();
  renderCountryList();
}

async function loadPosts() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  posts = [];
  snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
  renderPostList();
}

function updateCountrySelects() {
  const sel = document.getElementById('f-country');
  const filterSel = document.getElementById('list-country-filter');
  const currentVal = sel.value;
  const currentFilter = filterSel.value;

  sel.innerHTML = '<option value="">-- 国を選択 --</option>';
  filterSel.innerHTML = '<option value="">すべての国</option>';

  countries.forEach(c => {
    const opt1 = document.createElement('option');
    opt1.value = c.id;
    opt1.textContent = (c.flag ? c.flag + ' ' : '') + c.name;
    sel.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = c.id;
    opt2.textContent = (c.flag ? c.flag + ' ' : '') + c.name;
    filterSel.appendChild(opt2);
  });

  if (currentVal) sel.value = currentVal;
  if (currentFilter) filterSel.value = currentFilter;
}

// ===== タブ =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'post-list') renderPostList();
    if (tab === 'country-mgmt') renderCountryList();
  });
});

// ===== 新規投稿タブ =====

// メディア追加
document.getElementById('btn-add-media').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
});

function renderMediaList() {
  const container = document.getElementById('media-list');
  container.innerHTML = '';

  mediaRows.forEach((row, i) => {
    // メディア行
    const rowEl = document.createElement('div');
    rowEl.className = 'media-row';

    // 削除ボタン
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-media';
    removeBtn.textContent = '×';
    removeBtn.title = '削除';
    removeBtn.addEventListener('click', () => {
      if (editPostId && row.url) deletedMediaUrls.push(row.url);
      mediaRows.splice(i, 1);
      renderMediaList();
    });
    rowEl.appendChild(removeBtn);

    // ヘッダー行
    const header = document.createElement('div');
    header.className = 'media-row-header';

    // プレビュー
    const preview = document.createElement('div');
    preview.className = 'preview-wrap';
    if (row.url) {
      if (row.type === 'video') {
        const vid = document.createElement('video');
        vid.src = row.url;
        vid.preload = 'metadata';
        preview.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = row.url;
        img.alt = '';
        preview.appendChild(img);
      }
    } else {
      preview.textContent = 'No media';
    }
    header.appendChild(preview);

    // フィールド群
    const fields = document.createElement('div');
    fields.className = 'media-row-fields';

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'm-url';
    urlInput.placeholder = 'https://...';
    urlInput.value = row.url;
    urlInput.addEventListener('change', () => {
      mediaRows[i].url = urlInput.value;
      renderMediaList();
    });
    fields.appendChild(urlInput);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'm-type';
    const imgOpt = document.createElement('option');
    imgOpt.value = 'image'; imgOpt.textContent = '📷 写真';
    const vidOpt = document.createElement('option');
    vidOpt.value = 'video'; vidOpt.textContent = '🎬 動画';
    typeSelect.appendChild(imgOpt);
    typeSelect.appendChild(vidOpt);
    typeSelect.value = row.type;
    typeSelect.addEventListener('change', () => { mediaRows[i].type = typeSelect.value; renderMediaList(); });
    fields.appendChild(typeSelect);

    const captionTA = document.createElement('textarea');
    captionTA.className = 'm-caption';
    captionTA.rows = 9;
    captionTA.placeholder = 'キャプション（任意）';
    captionTA.style.width = '100%';
    captionTA.value = row.caption;
    captionTA.addEventListener('input', () => { mediaRows[i].caption = captionTA.value; });
    fields.appendChild(captionTA);

    header.appendChild(fields);
    rowEl.appendChild(header);

    // コントロール行
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    const coverLabel = document.createElement('label');
    coverLabel.className = 'cover-checkbox-label';
    const coverCb = document.createElement('input');
    coverCb.type = 'checkbox';
    coverCb.className = 'm-cover';
    coverCb.checked = !!row.isCover;
    coverCb.addEventListener('change', () => {
      mediaRows.forEach((r, j) => { r.isCover = (j === i && coverCb.checked); });
      renderMediaList();
    });
    coverLabel.appendChild(coverCb);
    coverLabel.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(coverLabel);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-upload';
    uploadBtn.textContent = '☁️ Cloudinaryにアップロード';
    uploadBtn.addEventListener('click', () => uploadMedia(i));
    controls.appendChild(uploadBtn);

    const progressSpan = document.createElement('span');
    progressSpan.className = 'upload-progress';
    progressSpan.id = `upload-progress-${i}`;
    controls.appendChild(progressSpan);

    const upBtn = document.createElement('button');
    upBtn.className = 'btn-move btn-small';
    upBtn.dataset.dir = 'up';
    upBtn.textContent = '↑';
    upBtn.disabled = i === 0;
    upBtn.addEventListener('click', () => {
      if (i > 0) { [mediaRows[i-1], mediaRows[i]] = [mediaRows[i], mediaRows[i-1]]; renderMediaList(); }
    });
    controls.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.className = 'btn-move btn-small';
    downBtn.dataset.dir = 'down';
    downBtn.textContent = '↓';
    downBtn.disabled = i === mediaRows.length - 1;
    downBtn.addEventListener('click', () => {
      if (i < mediaRows.length - 1) { [mediaRows[i], mediaRows[i+1]] = [mediaRows[i+1], mediaRows[i]]; renderMediaList(); }
    });
    controls.appendChild(downBtn);

    rowEl.appendChild(controls);
    container.appendChild(rowEl);

    // 挿入ボタン
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn-insert';
    insertBtn.dataset.pos = i + 1;
    insertBtn.textContent = '＋ ここに追加';
    insertBtn.addEventListener('click', () => {
      const pos = parseInt(insertBtn.dataset.pos);
      mediaRows.splice(pos, 0, { url: '', type: 'image', caption: '', isCover: false });
      renderMediaList();
    });
    insertWrap.appendChild(insertBtn);
    container.appendChild(insertWrap);
  });
}

// Cloudinaryアップロード
async function uploadMedia(idx) {
  const progressEl = document.getElementById(`upload-progress-${idx}`);
  if (!progressEl) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    progressEl.textContent = 'アップロード中…';

    try {
      const oldUrl = mediaRows[idx].url;
      if (oldUrl) deletedMediaUrls.push(oldUrl);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      mediaRows[idx].url = data.secure_url;
      mediaRows[idx].type = resourceType;
      renderMediaList();

      // 進捗更新（再描画後のelement取得）
      const newProgress = document.getElementById(`upload-progress-${idx}`);
      if (newProgress) {
        newProgress.textContent = '✓ アップロード完了';
        setTimeout(() => { if (newProgress) newProgress.textContent = ''; }, 2000);
      }
    } catch (err) {
      progressEl.textContent = 'エラー: ' + err.message;
    }
  });

  input.click();
}

// 投稿送信
document.getElementById('btn-submit-post').addEventListener('click', submitPost);

async function submitPost() {
  const countryId = document.getElementById('f-country').value;
  const date = document.getElementById('f-date').value;
  const title = document.getElementById('f-title').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const caption = document.getElementById('f-caption').value.trim();

  if (!countryId) { showToast('国を選択してください', true); return; }
  if (!date) { showToast('日付を入力してください', true); return; }
  if (!title) { showToast('タイトルを入力してください', true); return; }

  const mediaData = mediaRows.map(r => ({
    url: r.url,
    type: r.type,
    caption: r.caption,
    isCover: !!r.isCover
  }));

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), {
        countryId, date, title, location, caption,
        media: mediaData,
        updatedAt: serverTimestamp()
      });
      showToast('投稿を更新しました');
    } else {
      await addDoc(collection(db, 'posts'), {
        countryId, date, title, location, caption,
        media: mediaData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast('投稿しました');
    }

    await deleteFromCloudinary(deletedMediaUrls);
    resetPostForm();
    await loadPosts();
  } catch (err) {
    showToast('保存に失敗しました: ' + err.message, true);
  }
}

function resetPostForm() {
  document.getElementById('f-country').value = '';
  document.getElementById('f-date').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-caption').value = '';
  editPostId = null;
  mediaRows = [];
  deletedMediaUrls = [];
  document.getElementById('post-form-title').textContent = '新規投稿';
  document.getElementById('btn-submit-post').textContent = '投稿する';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}

document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

async function deleteFromCloudinary(urls) {
  for (const url of urls) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) continue;
    const publicId = match[1];
    const resourceType = url.includes('/video/upload/') ? 'video' : 'image';
    try {
      // Unsigned Upload環境では署名なし削除不可。Signed Uploadへの切り替えが必要。
      await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/destroy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_id: publicId })
        }
      );
    } catch (e) {
      console.warn('Cloudinary削除スキップ:', publicId, e);
    }
  }
}

// ===== 投稿一覧タブ =====

document.getElementById('list-country-filter').addEventListener('change', renderPostList);

function renderPostList() {
  const filterCountryId = document.getElementById('list-country-filter').value;
  const container = document.getElementById('post-list-container');
  container.innerHTML = '';

  const filtered = filterCountryId
    ? posts.filter(p => p.countryId === filterCountryId)
    : posts;

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-message">投稿がありません</p>';
    return;
  }

  const sorted = filtered.slice().sort((a, b) => b.date.localeCompare(a.date));
  sorted.forEach(post => {
    const country = countries.find(c => c.id === post.countryId);
    const countryName = country ? country.name : '(不明)';
    const media = post.media || [];
    const mediaCount = media.length;
    const hasCover = media.some(m => m.isCover);

    // サムネイル
    let thumbUrl = null;
    const coverImg = media.find(m => m.isCover && m.type === 'image');
    if (coverImg) thumbUrl = coverImg.url;
    if (!thumbUrl) {
      const firstImg = media.find(m => m.type === 'image');
      if (firstImg) thumbUrl = firstImg.url;
    }

    const item = document.createElement('div');
    item.className = 'post-list-item';

    const thumb = document.createElement('div');
    thumb.className = 'post-thumbnail';
    if (thumbUrl) {
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = '';
      thumb.appendChild(img);
    } else {
      thumb.textContent = '📷';
    }
    item.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'post-info';
    const titleEl = document.createElement('div');
    titleEl.className = 'post-title-text';
    titleEl.textContent = post.title;
    info.appendChild(titleEl);
    const meta = document.createElement('div');
    meta.className = 'post-meta-text';
    meta.textContent = `${countryName} ／ ${post.date} ／ 📎 ${mediaCount}件${hasCover ? ' ／ ★代表写真あり' : ''}`;
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'post-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit btn-small';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => {
      editPost(post);
      // 新規投稿タブへ切り替え
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="new-post"]').classList.add('active');
      document.getElementById('tab-new-post').classList.add('active');
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger btn-small';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`「${post.title}」を削除しますか？`)) return;
      try {
        await deleteDoc(doc(db, 'posts', post.id));
        showToast('投稿を削除しました');
        await loadPosts();
      } catch (err) {
        showToast('削除に失敗しました', true);
      }
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(actions);

    container.appendChild(item);
  });
}

function editPost(post) {
  editPostId = post.id;
  deletedMediaUrls = [];
  document.getElementById('f-country').value = post.countryId || '';
  document.getElementById('f-date').value = post.date || '';
  document.getElementById('f-title').value = post.title || '';
  document.getElementById('f-location').value = post.location || '';
  document.getElementById('f-caption').value = post.caption || '';
  mediaRows = (post.media || []).map(m => ({ ...m }));
  document.getElementById('post-form-title').textContent = '投稿を編集';
  document.getElementById('btn-submit-post').textContent = '更新する';
  document.getElementById('btn-cancel-edit').style.display = '';
  renderMediaList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== 国管理タブ =====

document.getElementById('btn-save-country').addEventListener('click', saveCountry);
document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

async function saveCountry() {
  const name = document.getElementById('c-name').value.trim();
  const flag = document.getElementById('c-flag').value.trim();
  const order = parseInt(document.getElementById('c-order').value) || 100;
  const subtitle = document.getElementById('c-subtitle').value.trim();
  const description = document.getElementById('c-description').value.trim();
  const editId = document.getElementById('edit-country-id').value;

  if (!name) { showToast('国名を入力してください', true); return; }

  const data = { name, flag, order, subtitle, description };

  try {
    if (editId) {
      await updateDoc(doc(db, 'countries', editId), data);
      showToast('国情報を更新しました');
    } else {
      await addDoc(collection(db, 'countries'), data);
      showToast('国を追加しました');
    }
    resetCountryForm();
    await loadCountries();
  } catch (err) {
    showToast('保存に失敗しました: ' + err.message, true);
  }
}

function resetCountryForm() {
  document.getElementById('c-name').value = '';
  document.getElementById('c-flag').value = '';
  document.getElementById('c-order').value = '100';
  document.getElementById('c-subtitle').value = '';
  document.getElementById('c-description').value = '';
  document.getElementById('edit-country-id').value = '';
  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

function renderCountryList() {
  const container = document.getElementById('country-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (countries.length === 0) {
    container.innerHTML = '<p class="empty-message">国データがありません</p>';
    return;
  }

  countries.forEach(c => {
    const postCount = posts.filter(p => p.countryId === c.id).length;

    const item = document.createElement('div');
    item.className = 'country-list-item';

    const flag = document.createElement('div');
    flag.className = 'country-flag';
    flag.textContent = c.flag || '🌐';
    item.appendChild(flag);

    const info = document.createElement('div');
    info.className = 'country-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'country-info-name';
    nameEl.textContent = c.name;
    info.appendChild(nameEl);
    const metaEl = document.createElement('div');
    metaEl.className = 'country-info-meta';
    metaEl.textContent = `表示順: ${c.order} ／ 投稿: ${postCount}件`;
    info.appendChild(metaEl);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'country-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit btn-small';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => {
      document.getElementById('c-name').value = c.name || '';
      document.getElementById('c-flag').value = c.flag || '';
      document.getElementById('c-order').value = c.order ?? 100;
      document.getElementById('c-subtitle').value = c.subtitle || '';
      document.getElementById('c-description').value = c.description || '';
      document.getElementById('edit-country-id').value = c.id;
      document.getElementById('country-form-title').textContent = '国を編集';
      document.getElementById('btn-cancel-country').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger btn-small';
    delBtn.textContent = '削除';
    delBtn.disabled = postCount > 0;
    delBtn.title = postCount > 0 ? '投稿がある国は削除できません' : '';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`「${c.name}」を削除しますか？`)) return;
      try {
        await deleteDoc(doc(db, 'countries', c.id));
        showToast('国を削除しました');
        await loadCountries();
      } catch (err) {
        showToast('削除に失敗しました', true);
      }
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(actions);

    container.appendChild(item);
  });
}

// ===== トースト =====
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}
