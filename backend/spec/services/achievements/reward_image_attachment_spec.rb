# frozen_string_literal: true

require "rails_helper"

# 獲得物の絵は、1つの獲得物に1つだけぶら下がっていること。
#
# 2件ぶら下がると `image.blob` が**古いほうを返す**ので、作り直しても
# 古い絵が出続ける。しかも `image_key` 列には新しい鍵が入るため、
# 「鍵は新しいのに絵は古い」という、画面からは気づけない食い違いになる。
RSpec.describe Achievements::RewardImageAttachment do
  # 1x1 の PNG。中身は問わないので最小のものを使う
  PNG = [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
          "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
          "0000000049454e44ae426082" ].pack("H*").freeze

  let(:reward) { RewardDefinition.find_by(key: "treasure_seed") || RewardDefinition.registry.first }

  before { RewardDefinition.registry }

  def attach!(name)
    reward.image.attach(io: StringIO.new(PNG), filename: "#{name}.png", content_type: "image/png")
    reward.update!(image_key: reward.reload.image.blob.key)
  end

  def attachment_count
    described_class.attachments_for(reward).count
  end

  # 貼り直しの本筋。**ここが壊れると、作り直しても古い絵が出続ける**
  describe "貼り直し" do
    it "絵が無いところへ貼れる" do
      reward.image.purge if reward.image.attached?

      attach!("first")

      expect(attachment_count).to eq(1)
      expect(reward.reload.image_path).to eq(reward.image.blob.key)
    end

    it "絵があるところへ貼り直しても1件のまま" do
      reward.image.purge if reward.image.attached?
      attach!("first")
      old = reward.reload.image.blob.key

      attach!("second")

      expect(attachment_count).to eq(1)
      expect(reward.reload.image.blob.key).not_to eq(old)
    end

    it "何度貼り直しても増えない" do
      reward.image.purge if reward.image.attached?
      3.times { |i| attach!("run#{i}") }

      expect(attachment_count).to eq(1)
    end
  end

  # 同時に貼られて重なった状態からの復旧。本番で起きたのはこれ
  describe "重なってしまった状態" do
    before do
      reward.image.purge if reward.image.attached?
      attach!("old")
      # 片付けの仕組みを通さずに、もう1件ぶら下げる（同時実行の再現）
      blob = ActiveStorage::Blob.create_and_upload!(
        io: StringIO.new(PNG), filename: "new.png", content_type: "image/png"
      )
      ActiveStorage::Attachment.create!(record: reward, name: "image", blob: blob)
      reward.update_columns(image_key: blob.key) # rubocop:disable Rails/SkipsModelValidations
      reward.reload
    end

    it "重なっていることを見つけられる" do
      expect(attachment_count).to eq(2)
      expect(described_class.duplicated).to include(reward)
    end

    it "image_key と同じ絵を残す（作り直した新しいほう）" do
      expect(described_class.keeper(reward).blob.key).to eq(reward.image_key)
    end

    it "片付けると1件になり、残るのは新しいほう" do
      expected = reward.image_key

      expect { described_class.prune_extras!(reward) }.to change { attachment_count }.from(2).to(1)

      expect(reward.reload.image.blob.key).to eq(expected)
      expect(reward.image_path).to eq(expected)
    end

    it "片付けたあとにもう一度流しても、何も起きない" do
      described_class.prune_extras!(reward)

      expect(described_class.prune_extras!(reward)).to eq(0)
      expect(attachment_count).to eq(1)
    end

    # **他の誰かが同じ絵を指しているなら消さない。** 消すと向こうが壊れる
    it "他と共有している絵は消さない" do
      other = RewardDefinition.where.not(id: reward.id).first
      old = described_class.attachments_for(reward).first
      ActiveStorage::Attachment.create!(record: other, name: "image", blob: old.blob)

      expect(described_class.prune_extras!(reward)).to eq(0)
      expect(attachment_count).to eq(2)
    end
  end

  # 先に消してから作ると、生成が落ちた時に絵の無い獲得物ができる
  describe "生成に失敗したとき" do
    before do
      reward.image.purge if reward.image.attached?
      attach!("keep-me")
    end

    it "絵を作れなければ、いまの絵はそのまま残る" do
      allow(GenerateImageService).to receive(:call).and_raise(Faraday::ConnectionFailed, "boom")
      kept = reward.reload.image.blob.key

      expect { Achievements::ImageGenerator.call(reward: reward) }
        .to raise_error(Achievements::ImageGenerator::GenerationError)

      expect(attachment_count).to eq(1)
      expect(reward.reload.image.blob.key).to eq(kept)
    end

    it "貼る途中で落ちても、いまの絵はそのまま残る" do
      kept = reward.reload.image.blob.key
      result = double(image_data: PNG, content_type: "image/png", metadata: { model: "test" })
      allow(GenerateImageService).to receive(:call).and_return(result)
      allow(reward).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(reward))

      expect { Achievements::ImageGenerator.call(reward: reward) }.to raise_error(StandardError)

      expect(attachment_count).to eq(1)
      expect(reward.reload.image.blob.key).to eq(kept)
    end
  end
end
