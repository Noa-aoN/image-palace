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

    # インフラは月額。請求書を見て入れる
    "infra_jpy.fly" => { group: "infra", label: "Fly.io", unit: "円/月", default: 0 },
    "infra_jpy.neon" => { group: "infra", label: "Neon", unit: "円/月", default: 0 },
    "infra_jpy.r2" => { group: "infra", label: "Cloudflare R2", unit: "円/月", default: 0 },
    "infra_jpy.workers" => { group: "infra", label: "Cloudflare Workers", unit: "円/月", default: 0 },
    "infra_jpy.sentry" => { group: "infra", label: "Sentry", unit: "円/月", default: 0 },
    "infra_jpy.domain" => { group: "infra", label: "ドメイン", unit: "円/月", default: 0 },
    "infra_jpy.other" => { group: "infra", label: "その他", unit: "円/月", default: 0 }
  }.freeze

  validates :key, presence: true, uniqueness: true
  validates :value, numericality: true

  # 値を引く。行が無ければ既定、既定も無ければ fallback
  def self.value_for(key, fallback = 0)
    row = find_by(key: key)
    return row.value.to_f if row

    DEFAULTS.dig(key, :default)&.to_f || fallback
  end

  # モデル+品質 → モデル の順に探す。品質別の単価を置いていなければモデルの値を使う
  def self.image_unit_usd(model:, quality: nil)
    with_quality = quality.present? ? value_for("image_usd.#{model}.#{quality}", -1) : -1
    return with_quality if with_quality >= 0

    value_for("image_usd.#{model}", 0)
  end

  def self.infra_monthly_jpy
    DEFAULTS.keys.select { |key| key.start_with?("infra_jpy.") }.sum { |key| value_for(key) }
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
