// Firebase の設定
// Firebase コンソール →「プロジェクトの設定」→「マイアプリ」に出てくる firebaseConfig をここに貼る。
// null のままなら、ログインなしで端末の中だけに記録する（今までと同じ動き）。
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDlNUj4UCFpGpqNPZvxx6hkBRH6S4B8qSY',
  authDomain: 'tangorun.firebaseapp.com',
  projectId: 'tangorun',
  storageBucket: 'tangorun.firebasestorage.app',
  messagingSenderId: '179646336495',
  appId: '1:179646336495:web:f67843f03737917d083a1a',
};

// 生徒のログインIDは、内部ではこのドメインのメールアドレスとして扱う（実際にメールは届かない）
const STUDENT_EMAIL_DOMAIN = 'students.tangorun.example.com';
