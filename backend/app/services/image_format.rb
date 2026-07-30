# frozen_string_literal: true

# 画像バイト列の形式をマジックバイトで判定する。
#
# libvips は Content-Type を信用せず中身を見てローダを選ぶため、
# 拡張子や Content-Type の検査だけでは SVG/PDF など危険なローダに到達しうる。
# libvips へ渡す前にここで allowlist し、PNG / JPEG / WebP 以外は一切デコードさせない。
module ImageFormat
  # 許可する形式（画像生成プロバイダの出力とユーザーアップロードの実用範囲）
  #
  # GIF を解禁する場合はここに :gif を足すだけでよい。
  # libvips の gifload は内蔵 libnsgif で外部委譲が無く、block_untrusted 下でも動作する
  # （8.16.1 で確認済み）ため、SVG/PDF のような危険性は無い。
  # ただしアニメ GIF は 1 コマ目のみ WebP 化される点に注意（new_from_buffer は n:1 が既定）。
  ALLOWED = %i[png jpeg webp].freeze

  # 判定に必要な先頭バイト数（WebP の "WEBP" は 8..11 バイト目）
  HEADER_SIZE = 12

  PNG_SIGNATURE = "\x89PNG\r\n\x1A\n".b
  JPEG_SIGNATURE = "\xFF\xD8\xFF".b
  RIFF_SIGNATURE = "RIFF".b
  WEBP_SIGNATURE = "WEBP".b
  GIF_SIGNATURES = [ "GIF87a".b, "GIF89a".b ].freeze

  module_function

  # @return [Symbol, nil] :png / :jpeg / :webp / :gif。判定できなければ nil
  #   判定できても ALLOWED に無い形式は libvips へ渡さない（allowed? で判断すること）
  def detect(data)
    return nil if data.nil?

    head = data.byteslice(0, HEADER_SIZE).to_s.b
    return nil if head.bytesize < HEADER_SIZE

    return :png if head.start_with?(PNG_SIGNATURE)
    return :jpeg if head.start_with?(JPEG_SIGNATURE)
    return :webp if head.start_with?(RIFF_SIGNATURE) && head.byteslice(8, 4) == WEBP_SIGNATURE
    return :gif if GIF_SIGNATURES.any? { |sig| head.start_with?(sig) }

    nil
  end

  # libvips に渡してよいバイト列か
  def allowed?(data)
    ALLOWED.include?(detect(data))
  end
end
