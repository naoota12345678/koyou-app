# 雇用契約書作成SaaS 仕様書

## プロジェクト概要

会社ごとに雇用契約書・労働条件通知書を作成・管理し、PDFで出力するWebアプリ。
複数クライアント企業を管理する社労士・経営コンサルタント向けSaaS。

**技術スタック**
- Frontend: Next.js 14（App Router）
- DB: Firebase Firestore
- 認証: Firebase Authentication
- PDF生成: jsPDF + jspdf-autotable
- スタイル: Tailwind CSS
- デプロイ: Vercel

---

## 認証設計

### 方式
- Firebase Authentication
- メール＋パスワード ＋ Googleログイン 併用

### ユーザーとデータの分離
- ユーザー登録時にFirestoreにユーザードキュメントを作成
- 全データに `userId` を持たせ、自分のデータしか見えないようFirestoreセキュリティルールで完全分離

### ページ構成
```
/login              ログイン（メール or Google）
/register           新規ユーザー登録

/dashboard          ダッシュボード（認証済みのみ）
/companies/[id]     会社詳細
/companies/[id]/contracts/new       書類新規作成
/companies/[id]/contracts/[id]      書類詳細・PDF出力

/admin              管理者専用（長谷部さんのみ）
  お知らせ投稿・編集
  全ユーザー一覧（将来：課金管理）
```

### Firestoreセキュリティルール（基本）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /companies/{companyId} {
      allow read, write: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }
    match /contracts/{contractId} {
      allow read, write: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }
    match /announcements/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.token.admin == true;
    }
  }
}
```

---

## Firestoreデータ構造

### users コレクション
```
users/{userId}
  email: string
  displayName: string
  role: 'user' | 'admin'
  createdAt: timestamp
```

### companies コレクション
```
companies/{companyId}
  userId: string                   // オーナー（必須）
  name: string                     // 会社名
  address: string                  // 所在地
  representative: string           // 代表取締役名

  // 労働条件デフォルト（書類作成時に自動入力・上書き可能）
  defaultStartHour: string         // 始業時 デフォルト (例: "9")
  defaultStartMinute: string       // 始業分 デフォルト (例: "00")
  defaultEndHour: string           // 終業時 デフォルト (例: "18")
  defaultEndMinute: string         // 終業分 デフォルト (例: "00")
  defaultWeeklyHours: number       // 週所定労働時間 デフォルト (例: 40)
  defaultBreakRule: string         // 休憩ルール（固定テキスト or カスタム）

  // 賃金関連デフォルト
  payClosingDay: string            // 賃金締切日 (例: "末日", "15日")
  paymentDay: string               // 支払日 (例: "翌月25日", "当月25日")

  // 処遇（デフォルト・上書き可）
  incrementDefault: boolean        // 昇給 有無デフォルト
  bonusDefault: boolean            // 賞与 有無デフォルト
  retirementAllowanceDefault: boolean  // 退職金 有無デフォルト
  retirementAllowanceDetail: string    // 退職金詳細テキスト

  // その他固定
  workRulesLocation: string        // 就業規則確認場所

  createdAt: timestamp
  updatedAt: timestamp
```

### contracts コレクション
```
contracts/{contractId}
  userId: string                   // オーナー（必須）
  companyId: string                // 紐づく会社ID

  // === 書類種別（自動決定） ===
  // documentType: 'roudou_muki' | 'roudou_yuki' | 'koyou_muki' | 'koyou_yuki'
  // → 下記の isYuki / isKoyou の組み合わせで自動決定
  documentType: string

  // === STEP1: 基本情報 ===
  employeeName: string             // 氏名
  issueDateYear: string            // 発行日（令和）
  issueDateMonth: string
  issueDateDay: string

  // === STEP2: 雇用形態・契約期間 ===
  employmentType: string           // 正社員 / 契約社員 / パートタイマー / アルバイト / 嘱託
  isYuki: boolean                  // 有期かどうか（true=有期, false=無期）
  isKoyou: boolean                 // 雇用契約書かどうか（true=雇用契約書, false=労働条件通知書）

  // 有期の場合
  contractStartYear: string
  contractStartMonth: string
  contractStartDay: string
  contractEndYear: string
  contractEndMonth: string
  contractEndDay: string
  renewalType: string              // '自動更新' | '更新あり' | '更新なし' | 'その他'
  renewalJudgmentItems: string[]   // 更新判断基準（複数選択）
  renewalLimitType: string         // 'none' | 'count' | 'years'
  renewalLimitCount: string
  renewalLimitYears: string
  mukiTransferYear: string         // 無期転換申込可能日
  mukiTransferMonth: string
  mukiTransferDay: string

  // 無期の場合
  trialPeriodMonths: number        // 試用期間（月数）デフォルト3

  // === STEP3: 就業情報 ===
  workplaceInitial: string         // 就業の場所（雇入れ直後）
  workplaceRange: string           // 就業の場所（変更の範囲）
  jobContentInitial: string        // 業務内容（雇入れ直後）
  jobContentRange: string          // 業務内容（変更の範囲）

  // === STEP4: 労働時間（会社デフォルト→上書き可） ===
  startHour: string
  startMinute: string
  endHour: string
  endMinute: string
  weeklyHours: number              // 週所定労働時間（社保判定に使用）
  weeklyDays: number               // 週所定労働日数

  // 副業・テレワーク
  sideJobPolicy: string            // '禁止' | '許可' | '届出制'
  teleworkAllowed: boolean

  // === STEP5: 賃金 ===
  salaryType: string               // 'monthly'（月給）| 'hourly'（時給）
  basicSalary: number              // 基本給（月給の場合）
  hourlyWage: number               // 時給（時給の場合）
  fixedOvertimeAmount: number      // 固定残業手当（円/月）
  fixedOvertimeHours: number       // 固定残業（時間/月）
  commuteAllowance: number         // 通勤手当（円/月）
  commuteAllowanceMax: number      // 通勤手当上限（円/月）
  totalSalary: number              // 総支給額
  payClosingDay: string            // 賃金締切日（会社デフォルト引継ぎ・上書き可）
  paymentDay: string               // 支払日

  increment: boolean               // 昇給
  bonus: boolean                   // 賞与
  retirementAllowance: boolean     // 退職金
  retirementAllowanceDetail: string

  // === 社会保険・雇用保険（自動判定 + 手動上書き可） ===
  // ※自動判定ロジックは下記参照
  socialInsurance: boolean         // 社会保険 有無（自動判定値）
  employmentInsurance: boolean     // 雇用保険 有無（自動判定値）
  socialInsuranceOverride: boolean // 手動上書きフラグ
  employmentInsuranceOverride: boolean

  // === メモ・管理情報 ===
  studentType: string              // '昼間学生' | '夜間・通信・定時制' | '学生でない'
  扶養希望: boolean                // 扶養範囲内希望
  recruitmentSource: string        // 採用経路（ハローワーク / 紹介 / 直接 / その他）
  remarks: string                  // 備考

  // === 在籍ステータス ===
  status: string                   // 'active'（在職）| 'retired'（退職）| 'leave'（休職）
  retiredAt: timestamp             // 退職日
  retirementReason: string         // '自己都合' | '会社都合' | '契約満了' | 'その他'
  retirementRemarks: string        // 退職備考

  createdAt: timestamp
  updatedAt: timestamp
```

### announcements コレクション
```
announcements/{announcementId}
  title: string                    // タイトル
  body: string                     // 本文（Markdown）
  category: string                 // '助成金' | '法改正' | '社会保険' | '年収の壁' | 'その他'
  importance: string               // 'high'（重要）| 'normal'
  targetCondition: string          // 'all' | 'tokutei'（特定適用事業所のみ）| 'small'（50人以下のみ）
  publishedAt: timestamp
  isPublished: boolean
  createdAt: timestamp
```

---

## 社会保険・雇用保険の自動判定ロジック

### 特定適用事業所の自動判定
```javascript
// 会社の在職中かつ週30時間以上の人数を自動カウント
// contracts コレクションから集計

function calcIsTokutei(contracts) {
  const count = contracts.filter(c =>
    c.status === 'active' &&
    c.weeklyHours >= 30
  ).length;
  return count >= 51;
  // true → 特定適用事業所（週20時間以上で社保適用）
  // false → 通常（週30時間以上で社保適用）
}
```

### 個人の社保・雇用保険判定
```javascript
function calcInsurance(contract, isTokutei) {
  const h = contract.weeklyHours;
  const isHirumaNickStudent = contract.studentType === '昼間学生';
  const salary = contract.totalSalary || 0;

  // 昼間学生は両方適用除外
  if (isHirumaNickStudent) {
    return { socialInsurance: false, employmentInsurance: false };
  }

  let socialInsurance = false;
  let employmentInsurance = false;

  if (isTokutei) {
    // 特定適用事業所（51人以上）
    // 週20時間以上 かつ 月額8.8万円以上（2028年廃止予定）で社保加入
    socialInsurance = h >= 20 && salary >= 88000;
    employmentInsurance = h >= 20;
  } else {
    // 通常（50人以下）
    socialInsurance = h >= 30;
    employmentInsurance = h >= 20;
  }

  return { socialInsurance, employmentInsurance };
}

// 注意事項（PDFに自動注記）:
// ※雇用契約書上の週所定労働時間で判定。実労働時間が2ヶ月連続で
//   閾値を超え継続見込みがある場合は3ヶ月目から加入義務が発生します。
```

### 夜間・通信・定時制学生の扱い
- 通常通り時間数で判定（昼間学生の除外なし）

---

## 書類種別の自動決定

```
STEP1: 雇用形態を選ぶ（正社員 / 契約社員 / パートタイマー / アルバイト / 嘱託）

STEP2: 契約期間を選ぶ
  ├─ 無期（期間の定めなし）→ 試用期間: ○ヶ月
  └─ 有期（期間の定めあり）→ 開始日・終了日・更新条件・5年ルール

STEP3: 書類種別を選ぶ（2択）
  ├─ 雇用契約書   → 署名欄あり・双方合意形式
  └─ 労働条件通知書 → 会社から従業員への通知形式

→ 有期 × 雇用契約書   → koyou_yuki
→ 有期 × 労働条件通知書 → roudou_yuki
→ 無期 × 雇用契約書   → koyou_muki
→ 無期 × 労働条件通知書 → roudou_muki
```

---

## 対応書類 4種類（PDF出力）

| 種別 | ファイル名 | 特徴 |
|------|-----------|------|
| 雇用契約書（無期） | koyou_muki | 署名欄あり・試用期間3ヶ月 |
| 雇用契約書（有期） | koyou_yuki | 署名欄あり・更新条件・5年ルール |
| 労働条件通知書（無期） | roudou_muki | 日付のみ・試用期間3ヶ月 |
| 労働条件通知書（有期） | roudou_yuki | 日付のみ・更新条件・5年ルール |

### 書類テンプレートの固定テキスト（入力不要）
以下は法令で定められているため固定：
- 割増賃金率（60時間以内125%・超150%・法定休日135%・深夜25%）
- 休憩時間（6時間以上45分・8時間以上60分）
- 定年制（60歳・再雇用65歳まで）
- 退職手続き（30日前届出）
- 変形労働時間制の記載（シフト制の場合）

---

## 入力フォームの設計（書類作成）

### 会社デフォルトの引き継ぎ
書類作成フォームを開いた時点で、会社マスタの以下の値を自動入力する。
ユーザーはそのまま使うか、上書きする。

```
始業・終業時刻     → defaultStartHour/Minute, defaultEndHour/Minute
週所定労働時間     → defaultWeeklyHours
賃金締切日・支払日  → payClosingDay, paymentDay
昇給・賞与・退職金  → incrementDefault, bonusDefault, retirementAllowanceDefault
就業規則確認場所   → workRulesLocation
```

### 社保・雇用保険のリアルタイム表示
週所定労働時間・学生区分を入力するたびに自動判定結果を表示。
手動上書きチェックボックスも用意する。

```
週所定労働時間: [__] 時間

→ 自動判定結果:
  社会保険:   ● 加入  / ○ 非加入
  雇用保険:   ● 加入  / ○ 非加入
  （特定適用事業所: 該当 / 非該当）

  □ 判定結果を手動で変更する（例外ケース用）
```

### 月給 / 時給の切り替え
```
賃金区分: ○ 月給制  ● 時給制

月給制の場合: 基本給（__円）のみ表示
時給制の場合: 時給（__円）のみ表示
→ 両方同時には入力させない
```

---

## 在籍管理・退職処理

### ステータス
```
active  → 在職（デフォルト）
leave   → 休職
retired → 退職
```

### 退職処理モーダル（契約詳細ページ）
```
退職日（令和__年__月__日）
退職理由:
  ○ 自己都合
  ○ 会社都合
  ○ 契約満了
  ○ その他
備考: [____________]

→ 保存でステータスを retired に変更
```

### 退職者の扱い
- 退職者は特定適用事業所の人数カウントから除外
- 書類一覧では「退職済み」バッジで表示
- データは削除せず保持（履歴として残す）

---

## ダッシュボード（/dashboard）

### 在籍サマリー（全社合計）
```
管理会社数:     N社
在職中:         N人
  うち社保加入:  N人
  うち雇用保険:  N人
退職者（今月）:  N人
```

### お知らせ・法改正情報
- カテゴリタブ（すべて / 助成金 / 法改正 / 社会保険 / 年収の壁）
- 重要なものはバナー表示
- targetCondition で出し分け
  - tokutei: 特定適用事業所（51人以上）を持つユーザーにのみ表示
  - small: 50人以下のユーザーにのみ表示
  - all: 全ユーザーに表示

---

## 管理者画面（/admin）

長谷部さんのみアクセス可（Firebase Custom Claims で admin フラグ管理）

### お知らせ管理
- 一覧・新規作成・編集・削除
- 本文はMarkdown入力
- プレビュー機能
- 公開/非公開の切り替え
- 対象条件の設定（all / tokutei / small）

### ユーザー管理（将来）
- 全ユーザー一覧
- 課金プラン管理（Stripe連携）

---

## 実装ステップ（推奨順序）

```
STEP 1: 認証実装
  - Firebase Auth（メール + Google）
  - ログイン・登録・ログアウト画面
  - 認証ガード（未ログインはリダイレクト）
  - Firestoreセキュリティルール設定

STEP 2: 会社マスタ（拡張版）
  - 会社登録・編集フォーム（デフォルト値含む）
  - 会社一覧・詳細ページ
  - 在籍サマリー表示
  - 特定適用事業所の自動判定表示

STEP 3: 退職管理
  - 在籍ステータス（active / leave / retired）
  - 退職処理モーダル（退職日・退職理由）
  - 退職者の人数カウント除外ロジック

STEP 4: 書類作成フォーム（拡張版）
  - STEP1〜5のウィザード形式
  - 会社デフォルトの自動引き継ぎ
  - 書類種別の自動決定
  - 社保・雇用保険のリアルタイム自動判定
  - 月給/時給の切り替え
  - 副業・テレワーク・学生区分・採用経路

STEP 5: PDF生成（jsPDF）
  - 4書類のテンプレート実装
  - 日本語フォント（NotoSansJP）
  - ダウンロード機能

STEP 6: お知らせ機能
  - ダッシュボードへの表示
  - カテゴリ・対象条件でのフィルタリング
  - 管理者投稿画面（/admin）
```

---

## PDF生成の詳細仕様

### 使用ライブラリ
```
jspdf: ^2.5.1
jspdf-autotable: ^3.8.2
```

### 日本語フォント
```
/public/fonts/NotoSansJP-Regular.ttf を配置
（Google Fontsからダウンロード）

CDNフォールバック:
https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.8/files/noto-sans-jp-japanese-400-normal.woff2
```

### レイアウト
```
用紙: A4（210×297mm）
余白: 上下左右 12mm
タイトル: 中央揃え 14pt
本文・表: 7.5pt
左カラム幅: 22mm（項目名）
右カラム幅: 残り全幅（内容）
```

### 自動注記（全書類共通）
```
以下をPDFフッター付近に自動挿入:
「※雇用契約書上の週所定労働時間が社会保険・雇用保険の加入判定基準となります。
  実労働時間が2ヶ月連続で基準を超え継続見込みがある場合は加入義務が生じます。」
```

---

## 環境変数（.env.local）

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## 備考・将来対応

- **賃金要件（月額8.8万円）** は2028年廃止予定。廃止後は週所定労働時間のみで判定。
- **企業規模要件の段階的拡大** 2027年〜2035年にかけて50人以下にも拡大予定。アプリ側のロジック更新が必要。
- **複数ユーザーで同一会社を管理**（例：担当者が複数いるクライアント）は将来対応。
- **Stripe連携による課金管理** は将来対応。
