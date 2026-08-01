# frozen_string_literal: true

# カード画像の縦横比。生成・保存・表示で同じ定義を使う。
#
# 種類は今後増える前提で、ここへ 1 エントリ足せば全体に効くようにしている。
# provider_size は画像生成 API へ渡すサイズ。crop_ratio が入っているものは、
# 生成後に OptimizeImageService でその比へ切り出す（API が直接出せない比のため）。
module AspectRatios
  DEFAULT = "square"

  ALL = {
    "square" => {
      label: "正方形",
      provider_size: "1024x1024",
      # 表示・保存とも 1:1
      ratio: 1.0,
      crop_ratio: nil
    },
    "portrait" => {
      label: "縦長",
      provider_size: "1024x1536",
      ratio: 1024.0 / 1536,
      crop_ratio: nil
    },
    # 黄金比は生成 API が直接出せないため、縦長で生成してから切り出す（試験導入）
    "golden" => {
      label: "黄金比（試験）",
      provider_size: "1024x1536",
      ratio: 1 / 1.618,
      crop_ratio: 1 / 1.618,
      experimental: true
    }
  }.freeze

  KEYS = ALL.keys.freeze

  module_function

  def valid?(key)
    KEYS.include?(key.to_s)
  end

  def fetch(key)
    ALL[key.to_s] || ALL[DEFAULT]
  end

  def provider_size(key)
    fetch(key)[:provider_size]
  end

  def crop_ratio(key)
    fetch(key)[:crop_ratio]
  end
end
