---
name: db-migrate
description: DBマイグレーションの作成・実行を行う。「マイグレーションを作って」「テーブルを追加して」と言われたときに使う
disable-model-invocation: true
argument-hint: "[migration description]"
---

Create and run a Rails DB migration for: $ARGUMENTS

## Steps

1. **Generate migration**: `rails g migration $ARGUMENTS`
2. **Edit migration file**: カラム定義・インデックス・制約を追加
3. **Run migration**: `rails db:migrate`
4. **Verify schema**: `db/schema.rb` を確認して意図通りか確認
5. **Update model**: バリデーション・アソシエーションを追加

## Rules

- PK は UUID を使う（`id: :uuid`）
- タイムスタンプは `timestamptz`（タイムゾーン付き）で統一
- `shared_media.normalized_prompt` には必ず UNIQUE 制約を付ける
- 既存マイグレーションは絶対に編集しない。修正は新しいマイグレーションで行う
- `change` で可逆でない場合は `up` / `down` を明示する
- マイグレーション実行後は必ず `db/schema.rb` の差分を確認する

## よく使うパターン

```ruby
# UUID PK
create_table :objects, id: :uuid do |t|
  t.string :name, null: false
  t.timestamps
end

# UNIQUE インデックス
add_index :shared_media, :normalized_prompt, unique: true

# 外部キー
add_reference :media, :object, null: false, foreign_key: true, type: :uuid
```
