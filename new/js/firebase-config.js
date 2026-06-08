// ============================================================
// firebase-config.js
// FirebaseとCloudinaryの設定をここに入力してください
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// -------------------------------------------------------
// 1. Firebaseの設定
//    Firebase Console > プロジェクト設定 > マイアプリ
//    から取得した値を貼り付けてください
// -------------------------------------------------------
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// -------------------------------------------------------
// 2. Cloudinaryの設定
//    Cloudinary Console > Dashboard から取得
// -------------------------------------------------------
export const CLOUDINARY_CONFIG = {
  cloudName:    "YOUR_CLOUD_NAME",   // 例: "my-travel-blog"
  uploadPreset: "YOUR_UPLOAD_PRESET" // Unsigned upload preset名
  // ※ Settings > Upload > Upload presets で
  //   "Unsigned" のプリセットを作成してください
};

// -------------------------------------------------------
// Firebase初期化（変更不要）
// -------------------------------------------------------
const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const auth = getAuth(app);
