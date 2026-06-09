# AKIRA travels — セットアップ手順

## ファイル構成

```
travel-blog/
├── index.html              # トップページ（国一覧）
├── country.html            # 国別ページ（投稿チェーン＋詳細モーダル）
├── 404.html                # GitHub Pages用リダイレクト
├── README.md               # このファイル
├── admin/
│   ├── index.html          # 管理画面HTML
│   └── index.js            # 管理画面ロジック（ES Module）
├── css/
│   ├── style.css           # 共通スタイル
│   └── admin.css           # 管理画面専用スタイル
└── js/
    └── firebase-config.js  # ★要編集：Firebase / Cloudinary 設定
```

---

## Step 1: Firebase の設定

1. [Firebase Console](https://console.firebase.google.com) でプロジェクトを作成
2. Firestore Database を有効化（本番モード、リージョン: `asia-northeast1`）
3. 以下のセキュリティルールを設定:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /countries/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /posts/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

4. Authentication → メール/パスワードを有効化
5. 「ユーザー」タブで管理者アカウントを作成
6. プロジェクト設定 → マイアプリ → ウェブアプリ登録 → `firebaseConfig` の値をコピー

---

## Step 2: Cloudinary の設定

1. [Cloudinary](https://cloudinary.com) で無料アカウントを作成
2. Settings → Upload → Upload presets → 「Add upload preset」
3. Signing Mode: **Unsigned** を選択して保存（プリセット名をメモ）
4. Dashboard から Cloud Name を確認

---

## Step 3: 設定ファイルの編集

`js/firebase-config.js` を開き、`YOUR_*` をすべて実際の値に置き換えます:

```javascript
const firebaseConfig = {
  apiKey:            "実際のAPIキー",
  authDomain:        "実際のプロジェクトID.firebaseapp.com",
  projectId:         "実際のプロジェクトID",
  storageBucket:     "実際のプロジェクトID.appspot.com",
  messagingSenderId: "実際のSender ID",
  appId:             "実際のApp ID"
};

export const CLOUDINARY_CONFIG = {
  cloudName:    "実際のCloud Name",
  uploadPreset: "実際のUpload Preset名"
};
```

---

## Step 4: GitHub Pages で公開

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

GitHub リポジトリ → Settings → Pages → Source: `main` / `/(root)` → Save

- 公開URL: `https://USERNAME.github.io/REPO/`
- 管理画面: `https://USERNAME.github.io/REPO/admin/`

---

## 注意事項

- **Cloudinary Unsigned Upload**: `upload_preset` を知っていれば誰でもアップロードできます。悪用リスクがある場合は Signed Upload に切り替えてください。
- **Cloudinary メディア削除**: Firestore からドキュメントを削除しても Cloudinary のファイルは削除されません。
- **Firestore クエリ**: `where + orderBy` の複合クエリは複合インデックスが必要なため、全件取得後に JS 側でフィルタリングしています。投稿数が増えた場合は複合インデックスの設定を検討してください。
