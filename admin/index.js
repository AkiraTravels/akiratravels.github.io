import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config-admin.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 状態変数
let countries = [];
let posts = [];
let mediaRows = [];
let editPostId = null;
let editCountryId = null;
let deletedMediaUrls = [];

// 認証監視
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('admin-main').style.display = '';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('header-user').style.display = 'flex';
    document.getElementById('header-email').textContent = user.email;
    loadAll();
  } else {
    document.getElementById('admin-main').style.display = 'none';
    document.getElementById('login-screen').style.display = '';
    document.getElementById('header-user').style.display = 'none';
  }
});

// ログイン
async function loginHandler() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errEl.textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
  }
}
document.getElementById('btn-login').addEventListener('click', loginHandler);
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginHandler();
});

// ログアウト
document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
});

// データ一括ロード
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  countries = [];
  const q = query(collection(db, 'countries'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  populateCountrySelects();
}

async function loadPosts() {
  posts = [];
  const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
}

function populateCountrySelects() {
  const fCountry = document.getElementById('f-country');
  const listFilter = document.getElementById('list-country-filter');
  
  const currentFVal = fCountry.value;
  const currentLVal = listFilter.value;

  fCountry.innerHTML = '<option value="">— 選択してください —</option>';
  listFilter.innerHTML = '<option value="">すべての国</option>';

  countries.forEach(c => {
    const text = c.flag ? `${c.flag} ${c.name}` : c.name;
    fCountry.innerHTML += `<option value="${c.id}">${text}</option>`;
    listFilter.innerHTML += `<option value="${c.id}">${text}</option>`;
  });

  fCountry.value = currentFVal;
  listFilter.value = currentLVal;
}

// タブ切り替え
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'post-list') renderPostList();
  if (tabName === 'country-mgmt') renderCountryList();
}

// メディア管理
document.getElementById('btn-add-media').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '' });
  renderMediaList();
});

function renderMediaList() {
  const listContainer = document.getElementById('media-list');
  listContainer.innerHTML = '';

  mediaRows.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'media-row';

    // ×ボタン
    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-remove-media';
    btnRemove.textContent = '×';
    btnRemove.onclick = () => {
      if (m.url) deletedMediaUrls.push(m.url);
      mediaRows.splice(idx, 1);
      renderMediaList();
    };
    row.appendChild(btnRemove);

    // ヘッダー（プレビュー & フィールド）
    const header = document.createElement('div');
    header.className = 'media-row-header';

    const previewWrap = document.createElement('div');
    previewWrap.className = 'preview-wrap';
    if (m.url) {
      if (m.type === 'video') {
        previewWrap.innerHTML = `<video src="${m.url}" preload="metadata"></video>`;
      } else {
        previewWrap.innerHTML = `<img src="${m.url}" alt="">`;
      }
    } else {
      previewWrap.textContent = 'No media';
    }
    header.appendChild(previewWrap);

    const fields = document.createElement('div');
    fields.className = 'media-row-fields';

    const inputUrl = document.createElement('input');
    inputUrl.className = 'm-url';
    inputUrl.type = 'url';
    inputUrl.value = m.url;
    inputUrl.placeholder = 'https://res.cloudinary.com/…';
    inputUrl.onchange = (e) => {
      mediaRows[idx].url = e.target.value;
      renderMediaList();
    };

    const selectType = document.createElement('select');
    selectType.className = 'm-type';
    selectType.innerHTML = '<option value="image">📷 写真</option><option value="video">🎬 動画</option>';
    selectType.value = m.type;
    selectType.onchange = (e) => {
      mediaRows[idx].type = e.target.value;
      renderMediaList();
    };

    const textCaption = document.createElement('textarea');
    textCaption.className = 'm-caption';
    textCaption.rows = 3;
    textCaption.value = m.caption;
    textCaption.placeholder = 'このメディアのキャプション（任意）';
    textCaption.oninput = (e) => {
      mediaRows[idx].caption = e.target.value;
    };

    fields.appendChild(inputUrl);
    fields.appendChild(selectType);
    fields.appendChild(textCaption);
    header.appendChild(fields);
    row.appendChild(header);

    // コントロール
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    const labelCover = document.createElement('label');
    labelCover.className = 'cover-checkbox-label';
    const chkCover = document.createElement('input');
    chkCover.type = 'checkbox';
    chkCover.className = 'm-cover';
    chkCover.onchange = async (e) => {
      if (e.target.checked && m.url) {
        const countryId = document.getElementById('f-country').value;
        if (!countryId) {
          showToast('国を選択してください', true);
          chkCover.checked = false;
          return;
        }
        await updateDoc(doc(db, 'countries', countryId), { imgUrl: m.url });
        showToast('国の代表写真を設定しました');
      }
    };
    labelCover.appendChild(chkCover);
    labelCover.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(labelCover);

    const btnUpload = document.createElement('button');
    btnUpload.className = 'btn-upload';
    btnUpload.textContent = '☁️ Cloudinaryにアップロード';
    btnUpload.onclick = () => uploadMedia(idx);
    controls.appendChild(btnUpload);

    if (idx > 0) {
      const btnUp = document.createElement('button');
      btnUp.className = 'btn-move';
      btnUp.textContent = '↑';
      btnUp.onclick = () => {
        [mediaRows[idx - 1], mediaRows[idx]] = [mediaRows[idx], mediaRows[idx - 1]];
        renderMediaList();
      };
      controls.appendChild(btnUp);
    }
    if (idx < mediaRows.length - 1) {
      const btnDown = document.createElement('button');
      btnDown.className = 'btn-move';
      btnDown.textContent = '↓';
      btnDown.onclick = () => {
        [mediaRows[idx], mediaRows[idx + 1]] = [mediaRows[idx + 1], mediaRows[idx]];
        renderMediaList();
      };
      controls.appendChild(btnDown);
    }

    const progressSpan = document.createElement('span');
    progressSpan.className = 'upload-progress';
    progressSpan.id = `upload-progress-${idx}`;
    controls.appendChild(progressSpan);

    row.appendChild(controls);
    listContainer.appendChild(row);

    // 行間挿入ボタン
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    const btnInsert = document.createElement('button');
    btnInsert.className = 'btn-insert';
    btnInsert.textContent = '＋ ここに挿入';
    btnInsert.onclick = () => {
      mediaRows.splice(idx + 1, 0, { url: '', type: 'image', caption: '' });
      renderMediaList();
    };
    insertWrap.appendChild(btnInsert);
    listContainer.appendChild(insertWrap);
  });
}

// Cloudinary アップロード
function uploadMedia(idx) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*';
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const progEl = document.getElementById(`upload-progress-${idx}`);
    progEl.textContent = 'アップロード中…';
    progEl.className = 'upload-progress';

    if (mediaRows[idx].url) deletedMediaUrls.push(mediaRows[idx].url);

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        mediaRows[idx].url = data.secure_url;
        mediaRows[idx].type = resourceType;
        renderMediaList();
        const newProg = document.getElementById(`upload-progress-${idx}`);
        newProg.textContent = '✓ アップロード完了';
        newProg.classList.add('success');
        setTimeout(() => { if(newProg) newProg.textContent = ''; }, 2000);
      } else {
        progEl.textContent = `エラー: ${data.error?.message || '失敗'}`;
        progEl.classList.add('error');
      }
    } catch (err) {
      progEl.textContent = 'エラー: 通信に失敗しました';
      progEl.classList.add('error');
    }
  };
  fileInput.click();
}

// 投稿の送信保存
document.getElementById('btn-submit').addEventListener('click', async () => {
  const countryId = document.getElementById('f-country').value;
  const date = document.getElementById('f-date').value;
  const title = document.getElementById('f-title').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const caption = document.getElementById('f-caption').value;

  if (!countryId) { showToast('国を選択してください', true); return; }
  if (!date) { showToast('日付を入力してください', true); return; }
  if (!title) { showToast('タイトルを入力してください', true); return; }

  const postData = {
    countryId, date, title, location, caption,
    media: mediaRows.map(m => ({
      url: m.url || '',
      type: m.type || 'image',
      caption: m.caption || ''
    })),
    updatedAt: serverTimestamp()
  };

  try {
    if (location.startsWith('https://')) {
      await updateDoc(doc(db, 'countries', countryId), { docUrl: location });
    }

    if (editPostId === null) {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿を保存しました');
    } else {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      showToast('投稿を更新しました');
    }

    await deleteFromCloudinary(deletedMediaUrls);
    resetPostForm();
    await loadPosts();
  } catch (err) {
    showToast('保存に失敗しました', true);
  }
});

function resetPostForm() {
  editPostId = null;
  deletedMediaUrls = [];
  mediaRows = [];
  document.getElementById('f-country').value = '';
  document.getElementById('f-date').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-caption').value = '';
  document.getElementById('form-title').textContent = '新規投稿';
  document.getElementById('btn-submit').textContent = '投稿する';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}

document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

async function deleteFromCloudinary(urls) {
  for (const url of urls) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) continue;
    const publicId = match[1];
    const resourceType = url.includes('/video/') ? 'video' : 'image';
    try {
      await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: publicId })
      });
    } catch (err) {
      console.warn('Cloudinary削除エラー（無視）:', err);
    }
  }
}

// 投稿一覧の描画表示
function renderPostList() {
  const filterId = document.getElementById('list-country-filter').value;
  const container = document.getElementById('post-list-container');
  container.innerHTML = '';

  let filtered = posts;
  if (filterId) {
    filtered = posts.filter(p => p.countryId === filterId);
  }

  filtered.sort((a, b) => b.date.localeCompare(a.date));

  if (filtered.length === 0) {
    container.innerHTML = '<p class="loading">投稿がありません</p>';
    return;
  }

  filtered.forEach(p => {
    const item = document.createElement('div');
    item.className = 'post-list-item';

    const thumb = document.createElement('div');
    thumb.className = 'post-thumbnail';
    const firstImg = p.media?.find(m => m.type === 'image');
    if (firstImg?.url) {
      thumb.innerHTML = `<img src="${firstImg.url}" alt="">`;
    } else {
      thumb.textContent = '📷';
    }
    item.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'post-info';
    const countryObj = countries.find(c => c.id === p.countryId);
    const countryName = countryObj ? countryObj.name : '不明な国';
    
    info.innerHTML = `
      <div class="post-title-text">${p.title}</div>
      <div class="post-meta-text">${countryName} ／ ${p.date} ／ 📎 ${p.media?.length || 0}件</div>
    `;
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit';
    btnEdit.textContent = '編集';
    btnEdit.onclick = () => {
      switchTab('new-post');
      editPostId = p.id;
      deletedMediaUrls = [];
      document.getElementById('f-country').value = p.countryId;
      document.getElementById('f-date').value = p.date;
      document.getElementById('f-title').value = p.title;
      document.getElementById('f-location').value = p.location || '';
      document.getElementById('f-caption').value = p.caption || '';
      mediaRows = (p.media || []).map(m => ({ ...m }));
      renderMediaList();
      document.getElementById('form-title').textContent = '投稿を編集';
      document.getElementById('btn-submit').textContent = '更新する';
      document.getElementById('btn-cancel-edit').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-danger';
    btnDel.textContent = '削除';
    btnDel.onclick = async () => {
      if (confirm('この投稿を削除しますか？')) {
        try {
          if (p.media) {
            const urls = p.media.map(m => m.url).filter(Boolean);
            await deleteFromCloudinary(urls);
          }
          await deleteDoc(doc(db, 'posts', p.id));
          showToast('投稿を削除しました');
          await loadPosts();
          renderPostList();
        } catch (e) {
          showToast('削除に失敗しました', true);
        }
      }
    };

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

document.getElementById('list-country-filter').addEventListener('change', renderPostList);

// 国管理
document.getElementById('btn-save-country').addEventListener('click', async () => {
  const name = document.getElementById('c-name').value.trim();
  const flag = document.getElementById('c-flag').value.trim();
  const order = Number(document.getElementById('c-order').value) || 100;
  const subtitle = document.getElementById('c-subtitle').value.trim();
  const description = document.getElementById('c-description').value;

  if (!name) { showToast('国名を入力してください', true); return; }

  const data = { name, flag, order, subtitle, description };

  try {
    if (editCountryId === null) {
      await addDoc(collection(db, 'countries'), data);
      showToast('国を追加しました');
    } else {
      await updateDoc(doc(db, 'countries', editCountryId), data);
      showToast('国を更新しました');
    }
    resetCountryForm();
    await loadAll();
    renderCountryList();
  } catch (err) {
    showToast('保存に失敗しました', true);
  }
});

function resetCountryForm() {
  editCountryId = null;
  document.getElementById('edit-country-id').value = '';
  document.getElementById('c-name').value = '';
  document.getElementById('c-flag').value = '';
  document.getElementById('c-order').value = '100';
  document.getElementById('c-subtitle').value = '';
  document.getElementById('c-description').value = '';
  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('btn-save-country').textContent = '保存';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

function renderCountryList() {
  const container = document.getElementById('country-list-container');
  container.innerHTML = '';

  if (countries.length === 0) {
    container.innerHTML = '<p class="loading">国データがありません</p>';
    return;
  }

  countries.forEach(c => {
    const postCount = posts.filter(p => p.countryId === c.id).length;

    const item = document.createElement('div');
    item.className = 'country-list-item';

    const flagCell = document.createElement('div');
    flagCell.className = 'country-flag-cell';
    flagCell.textContent = c.flag || '🌐';
    item.appendChild(flagCell);

    const info = document.createElement('div');
    info.className = 'country-item-info';
    info.innerHTML = `
      <div class="country-item-name">${c.name}</div>
      <div class="country-item-meta">表示順: ${c.order} ／ 投稿: ${postCount}件</div>
    `;
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'country-item-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit';
    btnEdit.textContent = '編集';
    btnEdit.onclick = () => {
      editCountryId = c.id;
      document.getElementById('edit-country-id').value = c.id;
      document.getElementById('c-name').value = c.name;
      document.getElementById('c-flag').value = c.flag || '';
      document.getElementById('c-order').value = c.order;
      document.getElementById('c-subtitle').value = c.subtitle || '';
      document.getElementById('c-description').value = c.description || '';
      document.getElementById('country-form-title').textContent = '国を編集';
      document.getElementById('btn-save-country').textContent = '更新';
      document.getElementById('btn-cancel-country').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-danger';
    btnDel.textContent = '削除';
    if (postCount > 0) {
      btnDel.disabled = true;
      btnDel.title = '投稿がある国は削除できません';
    } else {
      btnDel.onclick = async () => {
        if (confirm(`${c.name}を削除しますか？`)) {
          try {
            await deleteDoc(doc(db, 'countries', c.id));
            showToast('国を削除しました');
            await loadAll();
            renderCountryList();
          } catch (e) {
            showToast('削除に失敗しました', true);
          }
        }
      };
    }

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

// トースト通知表示
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  void toast.offsetWidth; // リフロー強制リセット
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}