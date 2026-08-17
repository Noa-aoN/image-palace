require "rails_helper"

# 二要素の要。ここが緩むと、二要素があっても無いのと同じになる。
RSpec.describe Auth::Totp do
  let(:secret) { described_class.generate_secret }

  describe "秘密鍵" do
    it "認証アプリが読める形（base32）で作る" do
      expect(secret).to match(/\A[A-Z2-7]+\z/)
    end

    it "毎回ちがう" do
      expect(described_class.generate_secret).not_to eq(secret)
    end

    it "推測しにくい長さがある（RFC 4226 は20バイト以上を推奨）" do
      # base32 は5ビットずつなので、20バイト = 32文字
      expect(secret.length).to be >= 32
    end
  end

  describe "コード" do
    it "6桁の数字を出す" do
      expect(described_class.code_at(secret)).to match(/\A\d{6}\z/)
    end

    it "同じ時刻・同じ鍵なら同じ" do
      at = Time.zone.parse("2026-08-12 10:00:00")

      expect(described_class.code_at(secret, at)).to eq(described_class.code_at(secret, at))
    end

    it "鍵がちがえばちがう" do
      at = Time.zone.parse("2026-08-12 10:00:00")

      expect(described_class.code_at(secret, at))
        .not_to eq(described_class.code_at(described_class.generate_secret, at))
    end

    it "30秒ごとに変わる" do
      at = Time.zone.parse("2026-08-12 10:00:00")

      expect(described_class.code_at(secret, at)).not_to eq(described_class.code_at(secret, at + 30))
    end

    # RFC 6238 の付録B。他の実装と同じ数字が出ることを確かめる
    it "RFC 6238 の例と一致する" do
      # 20バイトの "12345678901234567890" を base32 にしたもの
      rfc_secret = described_class.base32_encode("12345678901234567890")

      expect(described_class.code_at(rfc_secret, Time.zone.at(59))).to eq("287082")
      expect(described_class.code_at(rfc_secret, Time.zone.at(1_111_111_109))).to eq("081804")
    end
  end

  describe "確かめる" do
    it "いまのコードは通る" do
      expect(described_class.verify(secret, described_class.code_at(secret))).to be(true)
    end

    it "でたらめな数字は通らない" do
      expect(described_class.verify(secret, "000000")).to be(false)
    end

    # 端末の時計は数秒ずれる。ぴったりだけを通すと、押した瞬間に窓が変わって弾かれる
    it "1つ前・1つ後の窓まで通す" do
      expect(described_class.verify(secret, described_class.code_at(secret, Time.current - 30))).to be(true)
      expect(described_class.verify(secret, described_class.code_at(secret, Time.current + 30))).to be(true)
    end

    # 広げすぎると、盗み見たコードが使える時間が延びる
    it "2つ以上離れた窓は通さない" do
      expect(described_class.verify(secret, described_class.code_at(secret, Time.current - 120))).to be(false)
    end

    it "桁数が違えば通さない" do
      expect(described_class.verify(secret, "12345")).to be(false)
      expect(described_class.verify(secret, "1234567")).to be(false)
    end

    it "空や nil では通さない" do
      expect(described_class.verify(secret, "")).to be(false)
      expect(described_class.verify(secret, nil)).to be(false)
    end

    # 鍵を持っていない人は、何を出しても通らない
    it "鍵が無ければ通さない" do
      expect(described_class.verify(nil, "123456")).to be(false)
      expect(described_class.verify("", "123456")).to be(false)
    end

    it "空白や区切りが入っていても読む（画面から貼り付けられる形）" do
      code = described_class.code_at(secret)

      expect(described_class.verify(secret, "#{code[0, 3]} #{code[3, 3]}")).to be(true)
    end
  end

  describe "認証アプリへ渡す URI" do
    it "otpauth の形で、鍵と発行者を含む" do
      uri = described_class.provisioning_uri(secret, account: "someone@example.com")

      expect(uri).to start_with("otpauth://totp/")
      expect(uri).to include("secret=#{secret}")
      # 発行者名に空白が入るので、URI 側では %20 に化けているのが正しい
      expect(uri).to include("issuer=IMAGE%20PALACE")
    end

    # 記号を含むアドレスで URI が壊れると、読み取れない QR ができる
    it "記号を含むアドレスでも壊れない" do
      uri = described_class.provisioning_uri(secret, account: "a+b@example.com")

      expect(uri).not_to include("a+b@example.com")
      expect(uri).to include("%40")
    end
  end

  describe "base32" do
    it "往復して元に戻る" do
      expect(described_class.base32_decode(described_class.base32_encode("hello"))).to eq("hello")
    end

    it "読めない文字は断る" do
      expect { described_class.base32_decode("1890!") }.to raise_error(ArgumentError)
    end
  end
end
