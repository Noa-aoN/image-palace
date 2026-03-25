# 命名方針: Item / ItemType

## 基本方針

Ruby 組み込みクラスとの衝突を回避し、命名の一貫性を保つため、`Item` / `ItemType` に統一する。

**Object という単語は完全に使用しない。**

---

## なぜ Object を採用しなかったか

Ruby には組み込みクラス `Object` が存在する。ActiveRecord モデルで `class Object < ApplicationRecord` を定義すると、以下の問題が発生する：

1. **名前衝突**: Ruby の `Object` クラスを上書きしてしまう
2. **混乱**: `Object.new` がモデルを返すようになり、予期せぬ挙動
3. **gem 互換性**: 各種 gem が `Object` を参照する際に競合

---

## 命名ルール

| 層 | Item | ItemType |
|---|------|----------|
| テーブル | `items` | `item_types` |
| モデル | `Item` | `ItemType` |
| 外部キー | `item_id`, `from_item_id`, `to_item_id` | `item_type_id` |
| 関連 | `has_many :items`, `belongs_to :item` | `has_many :items`, `belongs_to :item_type` |

**方針**: ドメイン用語より実装安全性を優先する。

---

## グラフ構造における型定義

- **Node（ノード）**: `Item`（ユーザーが作成するカードの実体）
- **NodeType（ノード型）**: `ItemType`（term / concept / entity / person / event）

```
items ──belongs_to──> item_types
  │
  ├── from_relations ──> from_item_id
  └── to_relations   ──> to_item_id
```

---

## 将来の Card 概念

MVP リリース後、プレゼンテーション層で「Card」概念を導入する計画：

```
ユーザー向け: Card（カード）
実装: Item（アイテム）
```

- API レスポンスでは `card` フィールド名を使用
- 内部実装は `Item` のまま
- シリアライザで名称変換を行う

これにより、実装安全性と UX の両立を目指す。
