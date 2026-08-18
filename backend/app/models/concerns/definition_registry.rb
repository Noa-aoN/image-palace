# frozen_string_literal: true

# 定義表（実績・ミッション・獲得物）の読み直しを、**1リクエストの間だけ**やめる。
#
# `registry` は毎回 `ordered.to_a` で全件を読み直していた。
# アチーブメントの画面は1回の応答を作るのに `registry` を8か所以上から呼ぶので、
# 同じ表を何度も読んでいた（獲得物は 112 件ある）。
#
# **プロセスに溜め込まない。** 定義は管理画面から変えられるので、
# 溜め込むと「変えたのに反映されない」が起きる。
# `ActiveSupport::CurrentAttributes` は1リクエスト（1ジョブ）の終わりに
# 必ず捨てられるので、同じ応答の中でだけ効いて、次には持ち越さない。
#
# 鍵で引く `by_key` も一緒に持つ。`find_by(key:)` をループで回していた場所が
# ここを使えば、問い合わせは 0 本になる。
module DefinitionRegistry
  extend ActiveSupport::Concern

  # 1リクエストのあいだ、読んだ定義を置いておく場所
  class Store < ActiveSupport::CurrentAttributes
    attribute :rows, :indexes

    def fetch(klass)
      self.rows ||= {}
      rows[klass.name] ||= yield
    end

    def index(klass, rows)
      self.indexes ||= {}
      indexes[klass.name] ||= rows.index_by(&:key)
    end

    # 定義を書き換えたら捨てる（同じ応答の中で作り直したときに古い表を返さない）
    def forget(klass)
      rows&.delete(klass.name)
      indexes&.delete(klass.name)
    end
  end

  included do
    # 定義を作り替えたら覚え書きを捨てる。
    # **管理画面から直した直後の応答が、古い表を返さない**ようにするため。
    # 試験でも、例の中で定義を作り足したときに効く
    after_save { self.class.forget_registry! }
    after_destroy { self.class.forget_registry! }
  end

  class_methods do
    # 定義の一覧。同じリクエストの中では読み直さない。
    #
    # **組み込みの取り込みも、この中に入れる。** 外に出すと、手元と試験では
    # `ensure_builtins!` が毎回まるごと走る（あちらは変更をすぐ見せるため、
    # 意図的に短絡していない）。`registry` は1つの応答で8回以上呼ばれるので、
    # 外に置くとその回数だけ全件を舐めることになる。
    def registry
      Store.fetch(self) do
        ensure_builtins!
        registry_scope.to_a
      end
    end

    # 何を一緒に読むか。**添付を持つ定義は、ここで一緒に読む。**
    # 既定は並び順だけ。必要なモデルが上書きする
    def registry_scope
      ordered
    end

    # 鍵で引く。**ループの中で `find_by(key:)` を呼ばない**ためのもの
    def registry_by_key
      Store.index(self, registry)
    end

    # 鍵ひとつぶん。無ければ nil
    def from_registry(key)
      return nil if key.blank?

      registry_by_key[key.to_s]
    end

    # 定義を作り替えたあとに呼ぶ
    def forget_registry!
      Store.forget(self)
    end
  end
end
