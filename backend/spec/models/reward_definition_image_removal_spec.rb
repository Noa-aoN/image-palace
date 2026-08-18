# frozen_string_literal: true

require "rails_helper"

# 「絵が無い」状態は、いまのデータでは3つが同じ形になる。
#
#   ① まだ入れていない  ② 運営が外した  ③ 新しい環境で初期化前
#
# 添付と `image_key` を見るだけでは②が見分けられず、
# 組み込みの取り込みが**運営の判断を覆して鍵を埋め直して**いた。
# 外したときに `metadata` へ印を残し、そこで分ける（列は増やさない）。
RSpec.describe RewardDefinition do
  TINY = [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
           "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
           "0000000049454e44ae426082" ].pack("H*").freeze

  let(:key) { "medal_quiz" }
  let(:code_key) { described_class::BUILTINS.find { |b| b[:key] == key }[:image_key] }
  let(:row) { described_class.find_by(key: key) }

  before { described_class.registry }

  def resync!
    described_class.instance_variable_set(:@builtins_checked, false)
    described_class.forget_registry!
    described_class.ensure_builtins!
  end

  # 満たすべき4つ。1つでも崩れたら、どこかの環境で絵が壊れる
  describe "満たすべき4つ" do
    it "① 新しい環境では、コードの鍵をそのまま使える" do
      row.update_columns(image_key: nil) # rubocop:disable Rails/SkipsModelValidations

      resync!

      expect(row.reload.image_key).to eq(code_key)
    end

    it "② 古い死んだ鍵は、正しい鍵へ更新される" do
      row.update_columns(image_key: "dead000000000000000000000000") # rubocop:disable Rails/SkipsModelValidations

      resync!

      expect(row.reload.image_key).to eq(code_key)
    end

    it "③ その環境で作った絵は巻き戻さない" do
      row.image.attach(io: StringIO.new(TINY), filename: "own.png", content_type: "image/png")
      row.update!(image_key: row.reload.image.blob.key)
      own = row.image_key
      expect(own).not_to eq(code_key)

      resync!

      expect(row.reload.image_key).to eq(own)
    end

    it "④ 運営が外した絵は復活させない" do
      row.update!(image_key: nil,
                  metadata: row.metadata.merge(described_class::IMAGE_REMOVED_AT => Time.current.iso8601))

      resync!

      expect(row.reload.image_key).to be_nil
      expect(row.image_path).to be_nil
    end
  end

  describe "印の付け外し" do
    it "外したことは metadata に残る" do
      row.update!(image_key: nil,
                  metadata: row.metadata.merge(described_class::IMAGE_REMOVED_AT => Time.current.iso8601))

      expect(row.image_removed_by_admin?).to be true
    end

    it "印が無ければ、外されていない扱い" do
      expect(row.image_removed_by_admin?).to be false
    end

    # 入れ直したのに印が残ると、以後ずっと組み込みの取り込みが素通りする
    it "絵を作り直すと印は消える" do
      row.update!(image_key: nil,
                  metadata: row.metadata.merge(described_class::IMAGE_REMOVED_AT => Time.current.iso8601))
      result = double(image_data: TINY, content_type: "image/png", metadata: { model: "test" })
      allow(GenerateImageService).to receive(:call).and_return(result)

      Achievements::ImageGenerator.call(reward: row)

      expect(row.reload.image_removed_by_admin?).to be false
      expect(row.image_key).to be_present
    end
  end
end
