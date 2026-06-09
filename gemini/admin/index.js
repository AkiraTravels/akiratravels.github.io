import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import { 
  collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 状態管理
let countries = [];
let allPosts = [];
let mediaRows = [];
let editPostId = null;
let editCountryId = null;

// DOM要素のヘルパー
const $ = id => document.getElementById(id);

// 初期化と認証監視
onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').style.display = 'none';
    $('admin-main').style.display = 'block';
    $('header-user').style.display = 'flex';
    $('user-email').textContent = user.email;
    loadAll();
  } else {
    $('login-screen').style.display = 'block';
    $('admin-main').style.display = 'none';
    $('header-user').style.display = 'none';
  }
});

// ログイン・ログアウト処理
$('btn-login').onclick = async () => {
  const email = $('login-email').value.trim();
  const pass = $('login-password').value;
  $('login-error').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    $('login-error').textContent = 'ログインに失敗しました。認証情報を確認してください。';
  }
};
$('login-password').onkeydown = (e) => { if (e.key === 'Enter') $('btn-login').click(); };
$('btn-logout').onclick = () => signOut(auth);

// データ一括ロード
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  countries = [];
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  renderCountrySelect();
  renderCountryList();
}

async function loadPosts() {
  allPosts = [];
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  snap.forEach(d => allPosts.push({ id: d.id, ...d.data() }));
  renderPostList();
}

// タブ切り替え
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    $(target).classList.add('active');

    if (target === 'tab-post-list') renderPostList();
    if (target === 'tab-country-mgmt') renderCountryList();
  };
});

// フォームへの国セレクト動的挿入
function renderCountrySelect() {
  const select = $('f-country');
  select.innerHTML = countries.map(c => `<option value="${c.id}">${c.flag || ''} ${c.name}</option>`).join('');
}

// メディア行レンダリング
function renderMediaList() {
  const container = $('media-list');
  container.innerHTML = '';

  mediaRows.forEach((row, idx) => {
    const div = document.createElement('div');
    div.className = 'media-row';

    // プレビュー生成
    let previewHtml = '<span style="font-size:11px;color:#999;">No media</span>';
    if (row.url) {
      previewHtml = row.type === 'video' 
        ? `<video src="${row.url}"></video>` 
        : `<img src="${row.url}">`;
    }

    div.innerHTML = `
      <button type="button" class="btn-remove-media" data-idx="${idx}">×</button>
      <div class="media-row-header">
        <div class="preview-wrap" id="prev-${idx}">${previewHtml}</div>
        <div class="media-row-fields">
          <input type="url" class="m-url" data-idx="${idx}" placeholder="URL（Cloudinary自動入力または直接入力）" value="${row.url || ''}">
          <select class="m-type" data-idx="${idx}">
            <option value="image" ${row.type === 'image' ? 'selected' : ''}>📷 写真</option>
            <option value="video" ${row.type === 'video' ? 'selected' : ''}>🎬 動画</option>
          </select>
          <textarea class="m-caption" data-idx="${idx}" rows="2" placeholder="この写真/動画のキャプション（任意）">${row.caption || ''}</textarea>
        </div>
      </div>
      <div class="media-row-controls">
        <label><input type="checkbox" class="m-cover" data-idx="${idx}" ${row.isCover ? 'checked' : ''}> 代表写真にする</label>
        <button type="button" class="btn-upload" data-idx="${idx}">☁️ アップロード</button>
        <button type="button" class="btn-move" data-dir="up" data-idx="${idx}">↑</button>
        <button type="button" class="btn-move" data-dir="down" data-idx="${idx}">↓</button>
        <span class="upload-progress" id="progress-${idx}" style="display:none;"></span>
      </div>
    `;
    container.appendChild(div);

    // インサートボタン行
    const insWrap = document.createElement('div');
    insWrap.className = 'insert-btn-wrap';
    insWrap.innerHTML = `<button type="button" class="btn-insert" data-pos="${idx + 1}">＋ ここにメディア行を挿入</button>`;
    container.appendChild(insWrap);
  });

  bindMediaEvents();
}

function bindMediaEvents() {
  document.querySelectorAll('.btn-remove-media').forEach(b => {
    b.onclick = () => {
      const idx = parseInt(b.dataset.idx);
      mediaRows.splice(idx, 1);
      renderMediaList();
    };
  });

  document.querySelectorAll('.m-url').forEach(input => {
    input.oninput = () => {
      const idx = parseInt(input.dataset.idx);
      mediaRows[idx].url = input.value.trim();
      updatePreview(idx);
    };
  });

  document.querySelectorAll('.m-type').forEach(select => {
    select.onchange = () => {
      const idx = parseInt(select.dataset.idx);
      mediaRows[idx].type = select.value;
      updatePreview(idx);
    };
  });

  document.querySelectorAll('.m-caption').forEach(ta => {
    ta.oninput = () => {
      const idx = parseInt(ta.dataset.idx);
      mediaRows[idx].caption = ta.value;
    };
  });

  document.querySelectorAll('.m-cover').forEach(cb => {
    cb.onchange = () => {
      const idx = parseInt(cb.dataset.idx);
      mediaRows.forEach((r, i) => r.isCover = (i === idx));
      renderMediaList();
    };
  });

  document.querySelectorAll('.btn-upload').forEach(b => {
    b.onclick = () => uploadMedia(parseInt(b.dataset.idx));
  });

  document.querySelectorAll('.btn-move').forEach(b => {
    b.onclick = () => {
      const idx = parseInt(b.dataset.idx);
      const dir = b.dataset.dir;
      if (dir === 'up' && idx > 0) {
        [mediaRows[idx], mediaRows[idx - 1]] = [mediaRows[idx - 1], mediaRows[idx]];
      } else if (dir === 'down' && idx < mediaRows.length - 1) {
        [mediaRows[idx], mediaRows[idx + 1]] = [mediaRows[idx + 1], mediaRows[idx]];
      }
      renderMediaList();
    };
  });

  document.querySelectorAll('.btn-insert').forEach(b => {
    b.onclick = () => {
      const pos = parseInt(b.dataset.pos);
      mediaRows.splice(pos, 0, { url: '', type: 'image', caption: '', isCover: false });
      renderMediaList();
    };
  });
}

function updatePreview(idx) {
  const row = mediaRows[idx];
  const pWrap = $(`prev-${idx}`);
  if (row.url) {
    pWrap.innerHTML = row.type === 'video' ? `<video src="${row.url}"></video>` : `<img src="${row.url}">`;
  } else {
    pWrap.innerHTML = '<span style="font-size:11px;color:#999;">No media</span>';
  }
}

// Cloudinary アップロード処理
function uploadMedia(idx) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*';
  
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const prog = $(`progress-${idx}`);
    prog.textContent = 'アップロード中…';
    prog.style.display = 'inline';

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
        prog.textContent = '✓ アップロード完了';
        renderMediaList();
        setTimeout(() => { prog.style.display = 'none'; }, 2000);
      } else {
        prog.textContent = 'エラーが発生しました';
      }
    } catch (err) {
      console.error(err);
      prog.textContent = '通信失敗';
    }
  };
  fileInput.click();
}

$('btn-add-media-bottom').onclick = () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
};

// 投稿データの保存送信
$('btn-submit-post').onclick = async () => {
  const countryId = $('f-country').value;
  const date = $('f-date').value;
  const title = $('f-title').value.trim();

  if (!countryId || !date || !title) {
    showToast('国、日付、タイトルは必須項目です', true);
    return;
  }

  const postData = {
    countryId,
    date,
    title,
    location: $('f-location').value.trim(),
    caption: $('f-caption').value.trim(),
    media: mediaRows.map(r => ({ url: r.url, type: r.type, caption: r.caption, isCover: r.isCover })),
    updatedAt: serverTimestamp()
  };

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      showToast('投稿を更新しました');
    } else {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿を保存しました');
    }
    resetPostForm();
    await loadPosts();
  } catch (err) {
    console.error(err);
    showToast('保存に失敗しました', true);
  }
};

function resetPostForm() {
  $('f-date').value = '';
  $('f-title').value = '';
  $('f-location').value = '';
  $('f-caption').value = '';
  mediaRows = [];
  editPostId = null;
  $('form-title').textContent = '新規投稿';
  $('btn-submit-post').textContent = '投稿する →';
  $('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}
$('btn-cancel-edit').onclick = resetPostForm;

// 投稿一覧レンダリング
function renderPostList() {
  const wrap = $('list-posts');
  wrap.innerHTML = '';

  allPosts.forEach(p => {
    const c = countries.find(item => item.id === p.countryId);
    const cName = c ? c.name : '不明な国';
    
    let thUrl = '';
    if (p.media && p.media.length > 0) {
      const cover = p.media.find(m => m.isCover && m.type === 'image') || p.media.find(m => m.type === 'image');
      if (cover) thUrl = cover.url;
    }

    const item = document.createElement('div');
    item.className = 'post-list-item';

    const hasCoverText = p.media && p.media.some(m => m.isCover) ? ' ／ ★代表写真あり' : '';

    item.innerHTML = `
      <div class="preview-wrap">
        ${thUrl ? `<img src="${thUrl}">` : '<span style="font-size:20px;">📷</span>'}
      </div>
      <div class="post-info">
        <div class="post-title-text">${p.title}</div>
        <div class="post-meta-text">${cName} ／ ${p.date} ／ 📎 ${p.media ? p.media.length : 0}件${hasCoverText}</div>
      </div>
      <div class="post-actions">
        <button type="button" class="btn-edit-post" data-id="${p.id}">編集</button>
        <button type="button" class="btn-delete-post" data-id="${p.id}" style="color:red;">削除</button>
      </div>
    `;
    wrap.appendChild(item);
  });

  document.querySelectorAll('.btn-edit-post').forEach(b => {
    b.onclick = () => {
      const post = allPosts.find(p => p.id === b.dataset.id);
      if (!post) return;
      editPostId = post.id;
      $('f-country').value = post.countryId;
      $('f-date').value = post.date;
      $('f-title').value = post.title;
      $('f-location').value = post.location || '';
      $('f-caption').value = post.caption || '';
      mediaRows = post.media ? JSON.parse(JSON.stringify(post.media)) : [];
      
      $('form-title').textContent = '投稿の編集';
      $('btn-submit-post').textContent = '更新する →';
      $('btn-cancel-edit').style.display = 'inline-block';
      
      renderMediaList();
      document.querySelectorAll('.tab-btn')[0].click(); // 新規投稿タブを開く
    };
  });

  document.querySelectorAll('.btn-delete-post').forEach(b => {
    b.onclick = async () => {
      if (confirm('この投稿を削除してもよろしいですか？')) {
        await deleteDoc(doc(db, 'posts', b.dataset.id));
        showToast('投稿を削除しました');
        await loadPosts();
      }
    };
  });
}

// 国管理ロジック
$('btn-save-country').onclick = async () => {
  const name = $('c-name').value.trim();
  const flag = $('c-flag').value.trim();
  const order = parseInt($('c-order').value) || 100;
  const subtitle = $('c-subtitle').value.trim();
  const description = $('c-description').value.trim();

  if (!name) {
    showToast('国名は必須項目です', true);
    return;
  }

  const cData = { name, flag, order, subtitle, description };

  try {
    if (editCountryId) {
      await updateDoc(doc(db, 'countries', editCountryId), cData);
      showToast('国情報を更新しました');
    } else {
      await addDoc(collection(db, 'countries'), cData);
      showToast('国を追加しました');
    }
    resetCountryForm();
    await loadCountries();
  } catch (err) {
    console.error(err);
    showToast('エラーが発生しました', true);
  }
};

function resetCountryForm() {
  editCountryId = null;
  $('c-name').value = '';
  $('c-flag').value = '';
  $('c-order').value = '100';
  $('c-subtitle').value = '';
  $('c-description').value = '';
  $('country-form-title').textContent = '国の追加';
  $('btn-cancel-country').style.display = 'none';
}
$('btn-cancel-country').onclick = resetCountryForm;

function renderCountryList() {
  const wrap = $('list-countries');
  wrap.innerHTML = '';

  // 各国の投稿数を集計
  const counts = {};
  allPosts.forEach(p => { counts[p.countryId] = (counts[p.countryId] || 0) + 1; });

  countries.forEach(c => {
    const count = counts[c.id] || 0;
    const item = document.createElement('div');
    item.className = 'country-list-item';
    item.innerHTML = `
      <div style="font-size:24px; width:40px; text-align:center;">${c.flag || '🌍'}</div>
      <div class="country-list-info">
        <div style="font-weight:bold;">${c.name}</div>
        <div style="font-size:13px; color:var(--muted);">表示順: ${c.order} ／ 投稿: ${count}件</div>
      </div>
      <div>
        <button type="button" class="btn-edit-country" data-id="${c.id}">編集</button>
        <button type="button" class="btn-delete-country" data-id="${c.id}" ${count > 0 ? 'disabled' : ''} style="color:${count > 0 ? '#ccc' : 'red'};">削除</button>
      </div>
    `;
    wrap.appendChild(item);
  });

  document.querySelectorAll('.btn-edit-country').forEach(b => {
    b.onclick = () => {
      const c = countries.find(item => item.id === b.dataset.id);
      if (!c) return;
      editCountryId = c.id;
      $('c-name').value = c.name;
      $('c-flag').value = c.flag || '';
      $('c-order').value = c.order;
      $('c-subtitle').value = c.subtitle || '';
      $('c-description').value = c.description || '';
      $('country-form-title').textContent = '国の編集';
      $('btn-cancel-country').style.display = 'inline-block';
    };
  });

  document.querySelectorAll('.btn-delete-country').forEach(b => {
    b.onclick = async () => {
      if (confirm('この国を削除してもよろしいですか？')) {
        await deleteDoc(doc(db, 'countries', b.dataset.id));
        showToast('国情報を削除しました');
        await loadCountries();
      }
    };
  });
}

// トースト通知
function showToast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  if (isError) t.classList.add('error');
  else t.classList.remove('error');
  
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); }, 3000);
}
