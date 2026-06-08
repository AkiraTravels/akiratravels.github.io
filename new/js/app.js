// app.js — 閲覧側メインロジック

import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ===== AUTH =====
onAuthStateChanged(auth, user => {
  const area = document.getElementById('auth-area');
  if (!area) return;
  area.innerHTML = user
    ? `<a href="admin/" class="nav-btn">管理画面</a>`
    : `<a href="admin/" class="nav-btn secondary">管理者</a>`;
});

// ===== ROUTING =====
let currentCountryId = null;

window.goHome = function() {
  showPage('home');
  loadCountries();
};

window.goCountry = function(countryId) {
  currentCountryId = countryId;
  showPage('country');
  loadCountryPage(countryId);
};

window.goPost = function(postId) {
  showPage('post');
  loadPostPage(postId);
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

// ===== HOME =====
async function loadCountries() {
  const grid = document.getElementById('country-grid');
  grid.innerHTML = '<div class="loading-state">読み込み中...</div>';
  try {
    // orderBy単独 → 複合インデックス不要
    const [countriesSnap, postsSnap] = await Promise.all([
      getDocs(query(collection(db, 'countries'), orderBy('order', 'asc'))),
      getDocs(collection(db, 'posts'))
    ]);

    const postCount = {};
    postsSnap.forEach(d => {
      const cid = d.data().countryId;
      postCount[cid] = (postCount[cid] || 0) + 1;
    });

    grid.innerHTML = '';
    if (countriesSnap.empty) {
      grid.innerHTML = '<div class="loading-state">まだ国が登録されていません</div>';
      return;
    }

    countriesSnap.forEach(snap => {
      const c     = { id: snap.id, ...snap.data() };
      const count = postCount[c.id] || 0;
      const card  = document.createElement('div');
      card.className = 'country-card';
      card.innerHTML = `
        <div class="country-flag">${c.flag || ''}</div>
        <div class="country-name">${c.name}</div>
        <div class="country-count">${count} 投稿</div>
      `;
      card.onclick = () => goCountry(c.id);
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = '<div class="loading-state">読み込みに失敗しました<br><small>' + e.message + '</small></div>';
    console.error(e);
  }
}

// ===== COUNTRY PAGE =====
async function loadCountryPage(countryId) {
  const container = document.getElementById('posts-list');
  container.innerHTML = '<div class="loading-state">読み込み中...</div>';
  try {
    const countryDoc = await getDoc(doc(db, 'countries', countryId));
    if (!countryDoc.exists()) throw new Error('国が見つかりません');
    const country = { id: countryId, ...countryDoc.data() };
    document.getElementById('country-page-title').textContent = `${country.flag || ''} ${country.name}`;

    // where+orderBy複合クエリを避け、全件取得してJSでフィルタ＆ソート
    const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'asc')));
    const posts = [];
    postsSnap.forEach(d => {
      const p = { id: d.id, ...d.data() };
      if (p.countryId === countryId) posts.push(p);
    });

    container.innerHTML = '';
    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✈️</div>
          <div class="empty-state-text">まだ投稿がありません</div>
        </div>`;
      return;
    }

    // 日付でグループ化
    const groups = {};
    posts.forEach(p => {
      if (!groups[p.date]) groups[p.date] = [];
      groups[p.date].push(p);
    });

    Object.keys(groups).sort().forEach(date => {
      const dateGroup = document.createElement('div');
      dateGroup.className = 'date-group';

      const label = document.createElement('div');
      label.className     = 'date-label';
      label.textContent   = formatDate(date);
      dateGroup.appendChild(label);

      groups[date].forEach(post => {
        // 代表写真: isCoverフラグ優先、なければ最初の画像
        const coverMedia = (post.media || []).find(m => m.isCover && m.type === 'image')
                        || (post.media || []).find(m => m.type === 'image');
        const thumbHtml  = coverMedia
          ? `<div class="post-thumb"><img src="${coverMedia.url}" alt="" onerror="this.parentElement.textContent='📷'"></div>`
          : post.media?.find(m => m.type === 'video')
            ? `<div class="post-thumb">🎬</div>`
            : `<div class="post-thumb">📝</div>`;

        const item = document.createElement('div');
        item.className = 'post-item';
        item.innerHTML = `
          ${thumbHtml}
          <div class="post-info">
            <div class="post-title">${post.title}</div>
            <div class="post-meta">${(post.media || []).length} メディア${post.location ? ' · ' + post.location : ''}</div>
          </div>
          <div class="post-arrow">›</div>
        `;
        item.onclick = () => goPost(post.id);
        dateGroup.appendChild(item);
      });
      container.appendChild(dateGroup);
    });
  } catch (e) {
    container.innerHTML = '<div class="loading-state">読み込みに失敗しました<br><small>' + e.message + '</small></div>';
    console.error(e);
  }
}

// ===== POST DETAIL =====
async function loadPostPage(postId) {
  const feed = document.getElementById('media-feed');
  feed.innerHTML = '<div class="loading-state" style="padding:40px 20px;text-align:center">読み込み中...</div>';
  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) throw new Error('投稿が見つかりません');
    const post = { id: postId, ...postDoc.data() };

    document.getElementById('post-page-title').textContent = post.title;
    document.getElementById('post-page-date').textContent  =
      formatDate(post.date) + (post.location ? ' · ' + post.location : '');
    document.getElementById('back-to-country').onclick = () => goCountry(post.countryId);

    feed.innerHTML = '';
    if (!post.media || post.media.length === 0) {
      feed.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📷</div><div class="empty-state-text">メディアがありません</div></div>`;
      return;
    }

    post.media.forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = 'media-item';

      let mediaHtml = '';
      if (m.type === 'image') {
        mediaHtml = `<div class="media-wrapper"><img src="${m.url}" alt="${m.caption || ''}" loading="lazy"></div>`;
      } else {
        const vid = `vid-${postId}-${idx}`;
        mediaHtml = `
          <div class="media-wrapper">
            <video id="${vid}" src="${m.url}" playsinline webkit-playsinline muted preload="metadata"></video>
            <div class="video-overlay" id="ov-${vid}" onclick="toggleVideo('${vid}')">
              <div class="play-btn">
                <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
            </div>
          </div>`;
      }

      item.innerHTML = `
        ${mediaHtml}
        <div class="media-caption">
          <div class="caption-text">${m.caption || ''}</div>
          ${post.location ? `<div class="caption-location">📍 ${post.location}</div>` : ''}
        </div>
        <div class="media-actions">
          <button class="action-btn" onclick="toggleLike(this)"><span>♡</span> いいね</button>
          <button class="action-btn" onclick="copyLink()"><span>↗</span> シェア</button>
        </div>
      `;
      feed.appendChild(item);
    });

    setupVideoObserver();
  } catch (e) {
    feed.innerHTML = '<div class="loading-state">読み込みに失敗しました<br><small>' + e.message + '</small></div>';
    console.error(e);
  }
}

// ===== VIDEO =====
window.toggleVideo = function(vid) {
  const video   = document.getElementById(vid);
  const overlay = document.getElementById('ov-' + vid);
  if (video.paused) {
    video.play();
    overlay.classList.add('hidden');
    video.onended = () => overlay.classList.remove('hidden');
  } else {
    video.pause();
    overlay.classList.remove('hidden');
  }
};

function setupVideoObserver() {
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const v = e.target;
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        v.play().then(() => {
          const ov = document.getElementById('ov-' + v.id);
          if (ov) ov.classList.add('hidden');
        }).catch(() => {});
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('#media-feed video').forEach(v => obs.observe(v));
}

// ===== UTILS =====
window.toggleLike = function(btn) {
  btn.classList.toggle('liked');
  btn.querySelector('span').textContent = btn.classList.contains('liked') ? '♥' : '♡';
};

window.copyLink = function() {
  navigator.clipboard?.writeText(location.href).catch(() => {});
  showToast('リンクをコピーしました');
};

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日`;
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== INIT =====
loadCountries();
