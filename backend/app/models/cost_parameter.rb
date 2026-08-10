# frozen_string_literal: true

# 原価の概算に使う単価・レート。
#
# 行が無いキーは DEFAULTS の既定で動く。画面で触ったときだけ行ができる（GrantPolicy と同じ作法）。
#
# 既定値はあくまで初期値で、正確な数字ではない。OpenAI の価格も為替もこちらの都合で変わらないので、
# 「概算と請求実額を並べて乖離を見る」ことでしか確度は上がらない。MonthlyActual とセットで使う。
class CostParameter < ApplicationRecord
  GROUPS = %w[exchange payment image text infra].freeze

  # key => { group, label, unit, default, description }
  DEFAULTS = {
    "fx_usd_jpy" => {
      group: "exchange", label: "為替（USD→JPY）", unit: "円/USD", default: 155,
      description: "OpenAI の請求はドル建て。ここがずれると原価が丸ごとずれる"
    },
    "stripe_fee_rate" => {
      group: "payment", label: "決済手数料率", unit: "率", default: ::Billing::Catalog::STRIPE_FEE_RATE,
      description: "日本のカード決済。売上から引いて粗利を見る"
    },

    # 画像。モデル+品質のキーが無ければモデルだけのキーへ落ちる
    "image_usd.gpt-image-1" => {
      group: "image", label: "画像 gpt-image-1", unit: "USD/枚", default: 0.04,
      description: "品質別に分けたいときは image_usd.gpt-image-1.high のように足す"
    },
    "image_usd.gpt-image-1.low" => { group: "image", label: "画像 gpt-image-1（低品質）", unit: "USD/枚", default: 0.02 },
    "image_usd.gpt-image-1.medium" => { group: "image", label: "画像 gpt-image-1（中品質）", unit: "USD/枚", default: 0.04 },
    "image_usd.gpt-image-1.high" => { group: "image", label: "画像 gpt-image-1（高品質）", unit: "USD/枚", default: 0.17 },

    # 文章。100万トークンあたりの単価
    "text_in_usd.gpt-4o-mini" => { group: "text", label: "文章 gpt-4o-mini（入力）", unit: "USD/1Mトークン", default: 0.15 },
    "text_out_usd.gpt-4o-mini" => { group: "text", label: "文章 gpt-4o-mini（出力）", unit: "USD/1Mトークン", default: 0.6 },
    "text_in_usd.gpt-4o" => { group: "text", label: "文章 gpt-4o（入力）", unit: "USD/1Mトークン", default: 2.5 },
    "text_out_usd.gpt-4o" => { group: "text", label: "文章 gpt-4o（出力）", unit: "USD/1Mトークン", default: 10.0 },

    # インフラの月額。海外ベンダーはドル建てなので USD で持ち、為替を掛ける
    # （円で固定すると、為替が動いたときに黙ってずれる）。
    # 既定は構成から見積もった概算で、正確な額ではない。請求書の実額（MonthlyActual）で補正する。
    "infra_usd.fly" => {
      group: "infra", label: "Fly.io", unit: "USD/月", default: 13,
      description: "shared-cpu-1x / 1GB を2台（app + worker）稼働。待機1台は起動時のみ課金"
    },
    "infra_usd.neon" => {
      group: "infra", label: "Neon", unit: "USD/月", default: 19,
      description: "有料プラン。実額は請求書で確認して直す"
    },
    "infra_usd.workers" => {
      group: "infra", label: "Cloudflare Workers", unit: "USD/月", default: 5,
      description: "Workers Paid"
    },
    "infra_usd.r2" => {
      group: "infra", label: "Cloudflare R2", unit: "USD/月", default: 1,
      description: "egress は無料。保存量に応じて増える"
    },
    "infra_usd.sentry" => {
      group: "infra", label: "Sentry", unit: "USD/月", default: 0,
      description: "無料枠に収まっている想定"
    },
    "infra_jpy.domain" => {
      group: "infra", label: "ドメイン", unit: "円/月", default: 130,
      description: "年額を12で割った額"
    },
    "infra_jpy.other" => { group: "infra", label: "その他", unit: "円/月", default: 0 }
  }.freeze

  validates :key, presence: true, uniqueness: true
  validates :value, numericality: true

  # 値を引く。行が無ければ既定、既定も無ければ fallback。
  # 1件ずつ引くと SQL が回数ぶん飛ぶので、まとめて読むときは .table を使う
  def self.value_for(key, fallback = 0)
    row = find_by(key: key)
    return row.value.to_f if row

    DEFAULTS.dig(key, :default)&.to_f || fallback
  end

  # 全件を1回読んで、以後はメモリ上で引く。
  # 概算は同じ値を何十回も参照するため、都度 SQL だと往復だけで秒単位になる
  # （本番の DB は往復 69ms）。
  def self.table
    Table.new(all.index_by(&:key))
  end

  # 読み取り専用の値引き。クラスメソッドと同じ名前で使えるようにしてある
  class Table
    def initialize(rows)
      @rows = rows
    end

    def value_for(key, fallback = 0)
      row = @rows[key]
      return row.value.to_f if row

      DEFAULTS.dig(key, :default)&.to_f || fallback
    end

    # 画像1枚あたりの原価。
    #
    # 品質ごとの指定 → モデルごとの指定 → 登録簿（AiModel）の順に見る。
    # 登録簿を最後にしているのは、ここで細かく指定した値のほうが確かなため。
    # 逆に、新しく足したモデルは登録簿にしか値が無いので、そこで拾える。
    def image_unit_usd(model:, quality: nil)
      with_quality = quality.present? ? value_for("image_usd.#{model}.#{quality}", -1) : -1
      return with_quality if with_quality >= 0

      by_model = value_for("image_usd.#{model}", -1)
      return by_model if by_model >= 0

      AiModel.registry.find { |m| m.model_id == model }&.unit_cost_usd.to_f
    end

    def infra_monthly_jpy
      keys = (DEFAULTS.keys + @rows.keys).uniq
      jpy = keys.select { |key| key.start_with?("infra_jpy.") }.sum { |key| value_for(key) }
      usd = keys.select { |key| key.start_with?("infra_usd.") }.sum { |key| value_for(key) }
      jpy + usd * value_for("fx_usd_jpy")
    end
  end

  # モデル+品質 → モデル の順に探す。品質別の単価を置いていなければモデルの値を使う
  def self.image_unit_usd(model:, quality: nil)
    with_quality = quality.present? ? value_for("image_usd.#{model}.#{quality}", -1) : -1
    return with_quality if with_quality >= 0

    value_for("image_usd.#{model}", 0)
  end

  # インフラの月額（円）。ドル建てのものは為替を掛けて足す
  def self.infra_monthly_jpy
    jpy = infra_keys("infra_jpy.").sum { |key| value_for(key) }
    usd = infra_keys("infra_usd.").sum { |key| value_for(key) }
    jpy + usd * value_for("fx_usd_jpy")
  end

  # 既定に無いキーを足しても集計に入るよう、DB 側の行も見る
  def self.infra_keys(prefix)
    (DEFAULTS.keys + pluck(:key)).uniq.select { |key| key.start_with?(prefix) }
  end

  # 画面に出す一覧。DB の行と、まだ行が無い既定を合わせて返す
  def self.overview
    saved = all.index_by(&:key)

    (DEFAULTS.keys + saved.keys).uniq.map do |key|
      row = saved[key]
      default = DEFAULTS[key] || {}
      {
        key: key,
        group: default[:group] || "other",
        label: default[:label] || key,
        unit: default[:unit],
        description: default[:description],
        value: row ? row.value.to_f : default[:default].to_f,
        default_value: default[:default]&.to_f,
        customized: row.present?,
        note: row&.note
      }
    end
  end
end
