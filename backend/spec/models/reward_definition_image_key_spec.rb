# frozen_string_literal: true

require "rails_helper"

# 絵の鍵は、絵を持たない環境（手元・新しい環境）にとって**唯一の手がかり**。
#
# 以前は「空のときだけ埋める」だったので、本番で絵を作り直しても
# 手元の古い鍵が残り続けた。作り直すと古い実体は消えるので、
# その獲得物だけ絵が割れる（「問答の星章」で実際に起きた）。
RSpec.describe RewardDefinition do
  # 1x1 の PNG。中身は問わないので最小のものを使う
  TINY_PNG = [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
               "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
               "0000000049454e44ae426082" ].pack("H*").freeze

  let(:builtin_key) { "medal_quiz" }
  let(:code_key) { described_class::BUILTINS.find { |b| b[:key] == builtin_key }[:image_key] }
  let(:row) { described_class.find_by(key: builtin_key) }

  before { described_class.registry }

  def resync!
    described_class.instance_variable_set(:@builtins_checked, false)
    described_class.ensure_builtins!
  end

  describe "絵を持たない環境" do
    it "空なら、コードの鍵を入れる" do
      row.update_columns(image_key: nil) # rubocop:disable Rails/SkipsModelValidations

      resync!

      expect(row.reload.image_key).to eq(code_key)
    end

    it "古い鍵が入っていたら、コードの鍵へ揃える" do
      row.update_columns(image_key: "stale0000000000000000000000") # rubocop:disable Rails/SkipsModelValidations

      resync!

      expect(row.reload.image_key).to eq(code_key)
      expect(row.image_path).to eq(code_key)
    end

    it "同じなら書き込まない（毎回 UPDATE を撃たない）" do
      resync!
      before = row.reload.updated_at

      resync!

      expect(row.reload.updated_at).to eq(before)
    end
  end

  # **自分で絵を作った環境には触らない。**
  # 作り直した直後（コードへ書き戻す前）に古い値へ戻してしまう
  describe "自分で絵を作った環境" do
    before do
      row.image.attach(io: StringIO.new(TINY_PNG), filename: "own.png", content_type: "image/png")
      row.update!(image_key: row.reload.image.blob.key)
    end

    it "その環境の鍵を、コードの鍵で上書きしない" do
      own = row.reload.image_key
      expect(own).not_to eq(code_key)

      resync!

      expect(row.reload.image_key).to eq(own)
      expect(row.image_path).to eq(own)
    end
  end

  describe "全体" do
    it "組み込みの鍵と、絵を持たない行の鍵が食い違わない" do
      resync!

      mismatch = described_class::BUILTINS.reject do |b|
        r = described_class.find_by(key: b[:key])
        b[:image_key].blank? || r.nil? || r.image.attached? || r.image_key == b[:image_key]
      end

      expect(mismatch.map { |b| b[:key] }).to be_empty
    end
  end
end
