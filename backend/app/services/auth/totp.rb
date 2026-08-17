# frozen_string_literal: true

module Auth
  # 時刻に紐づく使い捨てコード（RFC 6238 の TOTP）。
  #
  # gem を足さない。標準の OpenSSL で足りる短い計算で、
  # 依存を1つ増やすほどの内容ではない。
  #
  # 仕組みは「共有した秘密鍵」と「いまの時刻」から同じ数字を出すだけ。
  # サーバーと認証アプリが同じ鍵と時計を持っていれば、通信せずに一致する。
  module Totp
    # 認証アプリが揃って対応している値。変えると既存の登録が全部合わなくなる
    DIGITS = 6
    PERIOD = 30
    ALGORITHM = "SHA1"

    # 前後1つぶんまで許す。
    #
    # 端末の時計は数秒ずれる。ぴったりだけを通すと、
    # 押した瞬間に窓が変わっただけで弾かれる。
    # 広げるほど、盗み見たコードが使える時間も延びるので1つに留める。
    DRIFT = 1

    # 秘密鍵の長さ（バイト）。RFC 4226 は最低16、20以上を推奨
    SECRET_BYTES = 20

    module_function

    # 新しい秘密鍵。base32 で持つ（認証アプリが読める形）
    def generate_secret
      base32_encode(SecureRandom.random_bytes(SECRET_BYTES))
    end

    # いまのコード。確かめる側も同じ計算をする
    def code_at(secret, at = Time.current)
      counter = (at.to_i / PERIOD)
      hmac = OpenSSL::HMAC.digest(ALGORITHM, base32_decode(secret), [ counter ].pack("Q>"))
      # 末尾4ビットが指す位置から4バイトを取り出す（動的切り出し）
      offset = hmac[-1].ord & 0x0f
      number = hmac[offset, 4].unpack1("N") & 0x7fffffff
      format("%0#{DIGITS}d", number % (10**DIGITS))
    end

    # 合っているか。**必ず定数時間で比べる**。
    # 文字列の比較を早く打ち切ると、どこまで合っていたかが時間から漏れる
    def verify(secret, code)
      return false if secret.blank?

      given = code.to_s.gsub(/\D/, "")
      return false unless given.length == DIGITS

      (-DRIFT..DRIFT).any? do |slide|
        expected = code_at(secret, Time.current + (slide * PERIOD))
        ActiveSupport::SecurityUtils.secure_compare(expected, given)
      end
    end

    # 認証アプリに読ませる URI。QR にするのは画面側の仕事
    # （画像を作る仕事をサーバーに持ち込まない）
    def provisioning_uri(secret, account:, issuer: "IMAGE PALACE")
      label = ERB::Util.url_encode("#{issuer}:#{account}")
      params = {
        secret: secret, issuer: issuer, algorithm: ALGORITHM,
        digits: DIGITS, period: PERIOD
      }.map { |k, v| "#{k}=#{ERB::Util.url_encode(v.to_s)}" }.join("&")

      "otpauth://totp/#{label}?#{params}"
    end

    # base32（RFC 4648）。認証アプリはこの形の鍵しか受け取らない。
    # 標準ライブラリに無いので、ここで持つ
    BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

    def base32_encode(bytes)
      bits = bytes.unpack1("B*")
      bits += "0" * ((5 - (bits.length % 5)) % 5)
      bits.scan(/.{5}/).map { |chunk| BASE32_ALPHABET[chunk.to_i(2)] }.join
    end

    def base32_decode(text)
      bits = text.to_s.upcase.delete("=").each_char.map do |char|
        index = BASE32_ALPHABET.index(char)
        raise ArgumentError, "base32 として読めません" if index.nil?

        index.to_s(2).rjust(5, "0")
      end.join
      # 8ビットに満たない端数は捨てる（詰めものなので中身を持たない）
      [ bits[0, bits.length - (bits.length % 8)] ].pack("B*")
    end
  end
end
