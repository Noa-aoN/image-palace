# Testing Conventions — ImagePalace 固有ルール

## 大原則

**テストなしのコードはマージ禁止。**
新機能・バグ修正すべてにテストを書くこと。

---

## Frontend: Vitest + Testing Library + MSW

### セットアップ

- テストファイル: `foo.ts` → `foo.test.ts`（ソースと同階層）
- フレームワーク: **Vitest**（Jest 互換 API）
- UI テスト: **@testing-library/react**
- API モック: **MSW (Mock Service Worker)**

### 構造

```ts
describe('ComponentName', () => {
  it('should <期待する挙動> when <条件>', () => {
    // arrange
    // act
    // assert
  })
})
```

### 何をテストするか

- ハッピーパス: 正常な入力で期待通りの出力
- エッジケース: 空入力、境界値、null/undefined
- エラーケース: 不正入力、API エラー、タイムアウト
- UI インタラクション: クリック、フォーム送信、状態変化

### 何をテストしないか

- 実装の詳細（private メソッド、内部 state）
- サードパーティライブラリの内部動作
- trivial な getter/setter

### モック規則

- API 呼び出しは MSW でモックする（`fetch` を直接モックしない）
- `beforeEach` / `afterEach` でモックをリセット
- `vi.fn()` でスパイ・スタブを作成

---

## Backend: RSpec + FactoryBot + SimpleCov

### セットアップ

- フレームワーク: **RSpec**
- テストデータ: **FactoryBot**（`spec/factories/` に定義）
- カバレッジ: **SimpleCov**（CI で 80% 未満はブロック）

### 構造

```ruby
RSpec.describe UserService, type: :service do
  describe '#call' do
    context '正常な入力の場合' do
      it '画像カードを作成して返す' do
        # arrange
        # act
        # assert
      end
    end

    context '同一単語のキャッシュがある場合' do
      it 'OpenAI API を呼び出さずキャッシュを返す' do
        # ...
      end
    end
  end
end
```

### テストの種類と配置

```
spec/
├── models/         # モデルのバリデーション・スコープ・メソッド
├── requests/       # API エンドポイント（統合テスト）
├── services/       # Service オブジェクトのロジック
├── jobs/           # ActiveJob
└── factories/      # FactoryBot 定義
```

### 何をテストするか

- モデル: バリデーション、スコープ、インスタンスメソッド
- リクエスト: ステータスコード、レスポンス JSON の構造
- サービス: ビジネスロジックの分岐（キャッシュあり/なし等）
- ジョブ: エンキューされることを確認（実行は統合テストで）

### FactoryBot 規則

- ファクトリは最小限の必須フィールドのみ定義
- `trait` でバリエーションを表現
- 本番データ・実際の認証情報は使わない

---

## TDD フロー（Claude Code 向け）

1. 失敗するテストを書く（Red）
2. テストが通る最小限のコードを書く（Green）
3. リファクタリング（Refactor）
4. `git commit` してから次の機能へ

Claude Code に実装を依頼する場合は「テストを先に書いてから実装してください」と伝えること。

---

## CI で必ず通すチェック

| チェック | ツール | 失敗条件 |
|--------|-------|---------|
| Frontend テスト | Vitest | 1件でも失敗 |
| Backend テスト | RSpec | 1件でも失敗 |
| カバレッジ | SimpleCov | 80% 未満 |
| Lint（TS） | ESLint | エラーあり |
| Lint（Ruby） | RuboCop | 警告あり |
| 型チェック | tsc --noEmit | エラーあり |
