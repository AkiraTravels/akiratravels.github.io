import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import { 
  collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let countries = [];
let allPosts = [];
let mediaRows = [];
let editPostId = null;
let editCountryId = null;

const $ = id => document.getElementById(id);

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

$('btn-login').onclick = async () => {
  const email = $('login-email').value.trim();
  const pass = $('login-password').value;
  $('login-error').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    $('login-error').textContent = 'ログインに失敗しました。';
  }
};
$('btn-logout').onclick = () => signOut(auth);

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

function renderCountrySelect() {
  const select = $('f-country');
  select.innerHTML = countries.map(c => `<option value="${c.id}">${c.flag || ''} ${c.name}</option>`).join('');
}

function renderMediaList() {
  const container = $('media-list');
  container.innerHTML = '';
  mediaRows.forEach((row, idx) => {
    const div = document.createElement('div');
    div.className = 'media-row';
    let previewHtml = '<span style="font-size:11px;color:#999;">No media</span>';
    if (row.url) {
      previewHtml = row.type === 'video' ? `<video src="${row.url}"></video>` : `<img src="${row.url}">`;
    }
    div.innerHTML = `
      <button type="button" class="btn-remove-media" data-idx="${idx}">×</button>
      <div class="media-row-header">
        <div class="preview-wrap" id="prev-${idx}">${previewHtml}</div>
        <div class="media-row-fields">
          <input type="url" class="m-url" data-idx="${idx}" placeholder="URL" value="${row.url || ''}">
          <select class="m-type" data-idx="${idx}">
            <option value="image" ${row.type === 'image' ? 'selected' : ''}>📷 写真</option>
            <option value="video" ${row.type === 'video' ? 'selected' : ''}>🎬 動画</option>
          </select>
          <textarea class="m-caption" data-idx="${idx}" rows="2" placeholder="キャプション">${row.caption || ''}</textarea>
        </div>
      </div>
      <div class="media-row-controls">
        <label><input type="checkbox" class="m-cover" data-idx="${idx}" ${row.isCover ? 'checked' : ''}> 代表にする</label>
        <button type="button" class="btn-upload" data-idx="${idx}">☁️ アップロード</button>
        <button type="button" class="btn-move" data-dir="up" data-idx="${idx}">↑</button>
        <button type="button" class="btn-move" data-dir="down" data-idx="${idx}">↓</button>
        <span class="upload-progress" id="progress-${idx}" style="display:none;"></span>
      </div>
    `;
    container.appendChild(div);
    const insWrap = document.createElement('div');
    insWrap.className = 'insert-btn-wrap';
    insWrap.innerHTML = `<button type="button" class="btn-insert" data-pos="${idx + 1}">＋ 挿入</button>`;
    container.appendChild(insWrap);
  });
  bindMediaEvents();
}

function bindMediaEvents() {
  document.querySelectorAll('.btn-remove-media').forEach(b => { b.onclick = () => { mediaRows.splice(parseInt(b.dataset.idx), 1); renderMediaList(); }; });
  document.querySelectorAll('.m-url').forEach(input => { input.oninput = () => { mediaRows[parseInt(input.dataset.idx)].url = input.value.trim(); updatePreview(parseInt(input.dataset.idx)); }; });
  document.querySelectorAll('.m-type').forEach(select => { select.onchange = () => { mediaRows[parseInt(select.dataset.idx)].type = select.value; updatePreview(parseInt(select.dataset.idx)); }; });
  document.querySelectorAll('.m-caption').forEach(ta => { ta.oninput = () => { mediaRows[parseInt(ta.dataset.idx)].caption = ta.value; }; });
  document.querySelectorAll('.m-cover').forEach(cb => { cb.onchange = () => { mediaRows.forEach((r, i) => r.isCover = (i === parseInt(cb.dataset.idx))); renderMediaList(); }; });
  document.querySelectorAll('.btn-upload').forEach(b => { b.onclick = () => uploadMedia(parseInt(b.dataset.idx)); });
  document.querySelectorAll('.btn-move').forEach(b => {
    b.onclick = () => {
      const idx = parseInt(b.dataset.idx);
      if (b.dataset.dir === 'up' && idx > 0) [mediaRows[idx], mediaRows[idx - 1]] = [mediaRows[idx - 1], mediaRows[idx]];
      else if (b.dataset.dir === 'down' && idx < mediaRows.length - 1) [mediaRows[idx], mediaRows[idx + 1]] = [mediaRows[idx + 1], mediaRows[idx]];
      renderMediaList();
    };
  });
  document.querySelectorAll('.btn-insert').forEach(b => { b.onclick = () => { mediaRows.splice(parseInt(b.dataset.pos), 0, { url: '', type: 'image', caption: '', isCover: false }); renderMediaList(); }; });
}

function updatePreview(idx) {
  const row = mediaRows[idx]; const pWrap = $(`prev-${idx}`);
  if (row.url) pWrap.innerHTML = row.type === 'video' ? `<video src="${row.url}"></video>` : `<img src="${row.url}">`;
  else pWrap.innerHTML = '<span style="font-size:11px;color:#999;">No media</span>';
}

function uploadMedia(idx) {
  const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*,video/*';
  fileInput.onchange = async () => {
    const file = fileInput.files[0]; if (!file) return;
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const prog = $(`progress-${idx}`); prog.textContent = '中…'; prog.style.display = 'inline';
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) { mediaRows[idx].url = data.secure_url; mediaRows[idx].type = resourceType; renderMediaList(); }
    } catch (err) { console.error(err); }
  };
  fileInput.click();
}

$('btn-add-media-bottom').onclick = () => { mediaRows.push({ url: '', type: 'image', caption: '', isCover: false }); renderMediaList(); };

$('btn-submit-post').onclick = async () => {
  const postData = {
    countryId: $('f-country').value, date: $('f-date').value, title: $('f-title').value.trim(),
    location: $('f-location').value.trim(), caption: $('f-caption').value.trim(),
    media: mediaRows.map(r => ({ url: r.url, type: r.type, caption: r.caption, isCover: r.isCover })), updatedAt: serverTimestamp()
  };
  try {
    if (editPostId) await updateDoc(doc(db, 'posts', editPostId), postData);
    else { postData.createdAt = serverTimestamp(); await addDoc(collection(db, 'posts'), postData); }
    resetPostForm(); await loadPosts(); showToast('保存しました');
  } catch (err) { console.error(err); }
};

function resetPostForm() { $('f-date').value = ''; $('f-title').value = ''; $('f-location').value = ''; $('f-caption').value = ''; mediaRows = []; editPostId = null; renderMediaList(); }

function renderPostList() {
  const wrap = $('list-posts'); wrap.innerHTML = '';
  allPosts.forEach(p => {
    const c = countries.find(item => item.id === p.countryId);
    const item = document.createElement('div'); item.className = 'post-list-item';
    item.innerHTML = `
      <div class="post-info"><div class="post-title-text">${p.title}</div><div class="post-meta-text">${c ? c.name : ''} / ${p.date}</div></div>
      <div><button type="button" class="btn-edit-post" data-id="${p.id}">編集</button></div>
    `;
    wrap.appendChild(item);
  });
  document.querySelectorAll('.btn-edit-post').forEach(b => {
    b.onclick = () => {
      const post = allPosts.find(p => p.id === b.dataset.id); if (!post) return;
      editPostId = post.id; $('f-country').value = post.countryId; $('f-date').value = post.date; $('f-title').value = post.title;
      $('f-location').value = post.location || ''; $('f-caption').value = post.caption || '';
      mediaRows = post.media ? JSON.parse(JSON.stringify(post.media)) : []; renderMediaList();
      document.querySelectorAll('.tab-btn')[0].click();
    };
  });
}

$('btn-save-country').onclick = async () => {
  const cData = { name: $('c-name').value.trim(), flag: $('c-flag').value.trim(), order: parseInt($('c-order').value) || 100, subtitle: $('c-subtitle').value.trim(), description: $('c-description').value.trim() };
  try {
    if (editCountryId) await updateDoc(doc(db, 'countries', editCountryId), cData);
    else await addDoc(collection(db, 'countries'), cData);
    resetCountryForm(); await loadCountries(); showToast('保存しました');
  } catch (err) { console.error(err); }
};

function resetCountryForm() { editCountryId = null; $('c-name').value = ''; $('c-flag').value = ''; $('c-order').value = '100'; $('c-subtitle').value = ''; $('c-description').value = ''; }

function renderCountryList() {
  const wrap = $('list-countries'); wrap.innerHTML = '';
  countries.forEach(c => {
    const item = document.createElement('div'); item.className = 'country-list-item';
    item.innerHTML = `<div class="country-list-info"><strong>${c.name}</strong> (順: ${c.order})</div><div><button type="button" class="btn-edit-country" data-id="${c.id}">編集</button></div>`;
    wrap.appendChild(item);
  });
  document.querySelectorAll('.btn-edit-country').forEach(b => {
    b.onclick = () => {
      const c = countries.find(item => item.id === b.dataset.id); if (!c) return;
      editCountryId = c.id; $('c-name').value = c.name; $('c-flag').value = c.flag || ''; $('c-order').value = c.order; $('c-subtitle').value = c.subtitle || ''; $('c-description').value = c.description || '';
    };
  });
}

function showToast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => { t.classList.remove('show'); }, 3000); }
