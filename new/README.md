# AKIRA travels — セットアップ手順

## Step 1: Firebase

1. [Firebase Console](https://console.firebase.google.com) でプロジェクト作成
2. Firestore Database を有効化（本番モード、リージョン: `asia-northeast1`）
3. セキュリティルールを設定（SPEC.md Section 4 参照）
4. Authentication → メール/パスワードを有効化
5. 「ユーザー」タブで管理者アカウントを作成
6. プロジェクト設定 → ウェブアプリ登録 → `firebaseConfig` の値をコピー

## Step 2: Cloudinary

1. [Cloudinary](https://cloudinary.com) で無料アカウント作成
2. Settings → Upload → Upload presets → 「Add upload preset」
3. Signing Mode: **Unsigned** を選択して保存
4. Dashboard から Cloud Name を確認

## Step 3: 設定ファイルの編集

`js/firebase-config.js` の `YOUR_*` をすべて実際の値に置き換えてください:

```javascript
const firebaseConfig = {
  apiKey:            "実際のAPIキー",
  authDomain:        "プロジェクトID.firebaseapp.com",
  projectId:         "プロジェクトID",
  storageBucket:     "プロジェクトID.appspot.com",
  messagingSenderId: "センダーID",
  appId:             "アプリID"
};

export const CLOUDINARY_CONFIG = {
  cloudName:    "クラウド名",
  uploadPreset: "アップロードプリセット名"
};
```

## Step 4: GitHub Pages 公開

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

## Firestore セキュリティルール

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
