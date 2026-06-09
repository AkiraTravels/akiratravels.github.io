import { 
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { app, CLOUDINARY_CONFIG } from "../js/firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

const DUMMY_IMAGE_URL = "https://placehold.co/600x400?text=Video+Post";

const localMediaMap = new Map();
let countriesCache = []; 
let parsedPosts = [];    

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }
  await loadCountriesMaster();
  await loadExistingPosts();
  initTabSystem();
  initNewPostForm();
});

document.getElementById('btn-logout').addEventListener('click', () => {
  signOut(auth).then(() => window.location.href = "./login.html");
});

function initTabSystem() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

async function loadCountriesMaster() {
  countriesCache = [];
  try {
    const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
    const selectElement = document.getElementById('form-post-country');
    selectElement.innerHTML = '<option value="">選択してください</option>';
    
    snap.forEach(docSnap => {
      const c = { id: docSnap.id, ...docSnap.data() };
      countriesCache.push(c);
      
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.flag || ''} ${c.name}`;
      selectElement.appendChild(opt);
    });
  } catch (err) {
    console.error("国情報のマスタ取得エラー:", err);
  }
}

async function loadExistingPosts() {
  const listContainer = document.getElementById('existing-posts-list');
  listContainer.innerHTML = "読み込み中...";
  try {
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
    if (snap.empty) {
      listContainer.innerHTML = "<p style='color:#999;'>登録済みの投稿がありません。</p>";
      return;
    }
    listContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const pId = docSnap.id;
      const country = countriesCache.find(c => c.id === data.countryId);
      
      const item = document.createElement('div');
      item.className = 'post-item';
      item.innerHTML = `
        <div>
          <strong style="font-size:16px;">${data.title}</strong> 
          <span style="color:#666; margin-left:10px;">(${data.date})</span>
          <span style="background:#e0d8cf; padding:2px 6px; font-size:12px; margin-left:10px; border-radius:3px;">
            ${country ? country.name : '未設定'}
          </span>
          <p style="margin:8px 0 0 0; font-size:14px; color:#444;">${data.caption}</p>
          <div style="margin-top:5px; font-size:12px; color:#888;">メディア数: ${data.media ? data.media.length : 0}件</div>
        </div>
        <button class="btn-danger btn-delete-post" data-id="${pId}">削除</button>
      `;
      listContainer.appendChild(item);
    });

    document.querySelectorAll('.btn-delete-post').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (confirm("この投稿データを本当にシステムから削除しますか？")) {
          const id = e.target.dataset.id;
          await deleteDoc(doc(db, 'posts', id));
          await loadExistingPosts(); 
        }
      });
    });
  } catch (err) {
    listContainer.innerHTML = `<p style="color:red;">一覧取得エラー: ${err.message}</p>`;
  }
}

function initNewPostForm() {
  const form = document.getElementById('form-new-post');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "処理中...";

    try {
      const newPost = {
        countryId: document.getElementById('form-post-country').value,
        title: document.getElementById('form-post-title').value,
        date: document.getElementById('form-post-date').value,
        location: document.getElementById('form-post-location').value || "",
        caption: document.getElementById('form-post-caption').value,
        media: [], 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'posts'), newPost);
      form.reset();
      alert("投稿の登録が完了しました。");
      await loadExistingPosts();
    } catch (err) {
      alert("投稿の登録に失敗しました: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "通常投稿を登録";
    }
  });
}

document.getElementById('import-media-dir').addEventListener('change', (e) => {
  localMediaMap.clear();
  for (const file of e.target.files) {
    localMediaMap.set(file.name, file);
  }
  document.getElementById('media-count-status').textContent = `（画像ファイル ${localMediaMap.size} 件をスキャン完了）`;
  pushLog(`ローカルから ${localMediaMap.size} 件のメディアファイルをインデックスしました。`);
});

document.getElementById('import-json-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const rawData = JSON.parse(event.target.result);
      if (!Array.isArray(rawData)) {
        alert("タイムライン投稿（配列形式）のJSONをロードしてください。");
        return;
      }
      parseAndRenderPreview(rawData);
    } catch (err) {
      alert("JSON解析失敗: " + err.message);
    }
  };
  reader.readAsText(file);
});

function parseAndRenderPreview(items) {
  const container = document.getElementById('import-preview-area');
  container.innerHTML = "";
  parsedPosts = [];

  pushLog("タイムラインJSONデータのパースを開始します...");

  items.forEach((item, index) => {
    if (!item.attachments && !item.data) return;

    const dateStr = new Date(item.timestamp * 1000).toISOString().split('T')[0];
    
    let caption = "";
    const extractedMedia = [];

    if (item.attachments) {
      item.attachments.forEach(attach => {
        if (!attach.data) return;
        attach.data.forEach(node => {
          if (node.media) {
            if (node.media.description && !caption) {
              caption = node.media.description; 
            }
            const fileName = node.media.uri.split('/').pop();
            const isVideo = node.media.uri.includes('videos/') || fileName.toLowerCase().endsWith('.mp4');

            extractedMedia.push({
              fileName: fileName,
              caption: node.media.description || "",
              type: isVideo ? 'video' : 'image'
            });
          }
        });
      });
    }

    const postObj = {
      id: `fb-${index}-${item.timestamp}`,
      date: dateStr,
      title: item.title || `${dateStr} の投稿`,
      caption: caption,
      rawMedia: extractedMedia
    };

    parsedPosts.push(postObj);

    const card = document.createElement('div');
    card.className = 'preview-card';
    card.id = `card-${postObj.id}`;

    let countryOptions = `<option value="">-- 国を選択 --</option>`;
    countriesCache.forEach(c => {
      countryOptions += `<option value="${c.id}">${c.flag || ''} ${c.name}</option>`;
    });

    card.innerHTML = `
      <div class="preview-header">
        <strong>📅 日付: ${postObj.date} — ${postObj.title}</strong>
        <div>
          <select id="select-country-${postObj.id}" style="padding:5px; border:1px solid #c4873a; border-radius:3px;">${countryOptions}</select>
          <button class="btn-single-import" data-id="${postObj.id}" style="padding:5px 12px; background:#c4873a; color:#fff; border:none; cursor:pointer; margin-left:5px; font-weight:bold; border-radius:3px;">インポート</button>
        </div>
      </div>
      <p style="font-size:13.5px; margin:5px 0; color:#222; line-height:1.4;">${postObj.caption || '<span style="color:#999; font-style:italic;">(テキスト本文なし)</span>'}</p>
      <div class="preview-media-list" id="media-list-${postObj.id}"></div>
    `;

    container.appendChild(card);

    const mediaListDiv = document.getElementById(`media-list-${postObj.id}`);
    postObj.rawMedia.forEach(m => {
      const span = document.createElement('span');
      span.style.cssText = 'font-size:11px; padding:3px 8px; border-radius:3px; display:inline-block; margin-right:5px;';
      
      if (m.type === 'video') {
        span.style.background = '#fff2cc';
        span.style.color = '#b25900';
        span.textContent = `📹 動画: ${m.fileName} (ダミー画像へ自動置換のうえテキストのみを同期します)`;
      } else {
        const hasFile = localMediaMap.has(m.fileName);
        span.style.background = hasFile ? '#e2f0d9' : '#fce4d6';
        span.style.color = hasFile ? '#2b5115' : '#a53c00';
        span.textContent = `📷 画像: ${m.fileName} (${hasFile ? 'ローカルファイル照合OK' : 'ファイル未検出'})`;
      }
      mediaListDiv.appendChild(span);
    });
  });

  pushLog(`インポート対象データ計 ${parsedPosts.length} 件を画面に展開しました。`);

  document.querySelectorAll('.btn-single-import').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      await executeSingleImport(e.target.dataset.id);
    });
  });
}

async function executeSingleImport(id) {
  const targetPost = parsedPosts.find(p => p.id === id);
  if (!targetPost) return;

  const countrySelect = document.getElementById(`select-country-${id}`);
  const countryId = countrySelect.value;

  if (!countryId) {
    alert("この投稿を紐付ける対象の国を選択してください。");
    return;
  }

  const card = document.getElementById(`card-${id}`);
  const btn = card.querySelector('.btn-single-import');
  
  btn.disabled = true;
  btn.textContent = "同期中...";
  countrySelect.disabled = true;

  pushLog(`[処理開始] ${targetPost.date} の投稿データを処理中...`);

  try {
    const finalMediaArray = [];

    for (const m of targetPost.rawMedia) {
      if (m.type === 'video') {
        finalMediaArray.push({
          url: DUMMY_IMAGE_URL,
          type: "image",
          caption: m.caption,
          isCover: finalMediaArray.length === 0
        });
        pushLog(`  -> 動画ファイル "${m.fileName}" をダミープレースホルダーに置換してキャプションを維持しました。`);
      } else {
        const fileObj = localMediaMap.get(m.fileName);
        if (fileObj) {
          pushLog(`  -> 画像をストレージにアップロード中: ${m.fileName}`);
          const uploadedUrl = await uploadToCloudinary(fileObj);
          
          finalMediaArray.push({
            url: uploadedUrl,
            type: "image",
            caption: m.caption,
            isCover: finalMediaArray.length === 0
          });
        } else {
          pushLog(`  -> [スキップ] ${m.fileName} のローカル物理画像が存在しないためスキップ。`, true);
        }
      }
    }

    const newFirestorePost = {
      countryId: countryId,
      title: targetPost.title,
      date: targetPost.date, 
      location: "", 
      caption: targetPost.caption,
      media: finalMediaArray,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, 'posts'), newFirestorePost);
    
    pushLog(`[同期成功] Firestoreへインポート完了: ${targetPost.date}`);
    card.style.background = "#f4f9f4";
    card.style.borderColor = "#a3cca3";
    card.style.opacity = "0.7";
    btn.textContent = "インポート完了";
    btn.style.background = "#6c757d";

    await loadExistingPosts();

  } catch (err) {
    pushLog(`[同期失敗] 同期中にエラーが発生しました: ${err.message}`, true);
    btn.disabled = false;
    btn.textContent = "再試行";
    countrySelect.disabled = false;
  }
}

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Cloudinary APIエラー: ${res.statusText}`);
  const data = await res.json();
  return data.secure_url;
}

function pushLog(msg, isError = false) {
  const logDiv = document.getElementById('import-log');
  const line = document.createElement('div');
  line.style.color = isError ? '#ff6666' : '#00ff66';
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logDiv.appendChild(line);
  logDiv.scrollTop = logDiv.scrollHeight;
}
