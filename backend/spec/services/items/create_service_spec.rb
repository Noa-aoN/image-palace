require "rails_helper"

RSpec.describe Items::CreateService, type: :service do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  describe ".call" do
    it "creates a pending item with default item type and enqueues image generation" do
      result = nil

      # 画像の前に下ごしらえ（説明文・情景プロンプト）を挟み、そこから画像生成へ引き継ぐ
      expect {
        expect {
          result = described_class.call(user: user, params: { title: "富士山" })
        }.to have_enqueued_job(GenerateBriefJob)
      }.to change { user.items.count }.by(1)

      item = result.item
      expect(item.title).to eq("富士山")
      expect(item.generation_status).to eq("pending")
      expect(item.brief_status).to eq("pending")
      expect(item.item_type_id).to eq(item_type.id)
      expect(item.generation_error).to be_nil
    end

    it "passes through force_generate to the enqueued job" do
      described_class.call(user: user, params: { title: "富士山", force_generate: true })

      expect(enqueued_jobs.last[:args][1].with_indifferent_access[:force_generate]).to be true
    end

    it "スタイルとカスタムプロンプトを保存する" do
      result = described_class.call(user: user, params: { title: "cat", style: "watercolor", custom_prompt: "wearing a hat" })

      expect(result.item.style).to eq("watercolor")
      expect(result.item.custom_prompt).to eq("wearing a hat")
    end

    it "スタイル未指定なら設定のデフォルト画像スタイルを使う" do
      create(:setting, user: user, default_image_style: "photo")

      result = described_class.call(user: user, params: { title: "cat" })

      expect(result.item.style).to eq("photo")
    end

    it "スタイルを明示指定した場合はデフォルト画像スタイルより優先される" do
      create(:setting, user: user, default_image_style: "photo")

      result = described_class.call(user: user, params: { title: "cat", style: "anime" })

      expect(result.item.style).to eq("anime")
    end

    it "意味の自動生成設定が ON のとき GenerateMeaningJob もエンキューする" do
      create(:setting, user: user, auto_generate_meanings: true)

      expect {
        described_class.call(user: user, params: { title: "光合成" })
      }.to have_enqueued_job(GenerateMeaningJob)
    end

    it "意味の自動生成設定が OFF のとき GenerateMeaningJob はエンキューしない" do
      create(:setting, user: user, auto_generate_meanings: false)

      expect {
        described_class.call(user: user, params: { title: "光合成" })
      }.not_to have_enqueued_job(GenerateMeaningJob)
    end

    it "generate_meaning が true のとき設定 OFF でも GenerateMeaningJob をエンキューする" do
      create(:setting, user: user, auto_generate_meanings: false)

      expect {
        described_class.call(user: user, params: { title: "光合成", generate_meaning: true })
      }.to have_enqueued_job(GenerateMeaningJob)
    end

    it "generate_meaning が false のとき設定 ON でも GenerateMeaningJob はエンキューしない" do
      create(:setting, user: user, auto_generate_meanings: true)

      expect {
        described_class.call(user: user, params: { title: "光合成", generate_meaning: false })
      }.not_to have_enqueued_job(GenerateMeaningJob)
    end

    it "タグの自動生成設定が ON のとき GenerateTagsJob もエンキューする" do
      create(:setting, user: user, auto_generate_tags: true)

      expect {
        described_class.call(user: user, params: { title: "光合成" })
      }.to have_enqueued_job(GenerateTagsJob)
    end

    it "タグの自動生成設定が OFF のとき GenerateTagsJob はエンキューしない" do
      create(:setting, user: user, auto_generate_tags: false)

      expect {
        described_class.call(user: user, params: { title: "光合成" })
      }.not_to have_enqueued_job(GenerateTagsJob)
    end

    it "generate_tags が true のとき設定 OFF でも GenerateTagsJob をエンキューする" do
      create(:setting, user: user, auto_generate_tags: false)

      expect {
        described_class.call(user: user, params: { title: "光合成", generate_tags: true })
      }.to have_enqueued_job(GenerateTagsJob)
    end

    it "generate_tags が false のとき設定 ON でも GenerateTagsJob はエンキューしない" do
      create(:setting, user: user, auto_generate_tags: true)

      expect {
        described_class.call(user: user, params: { title: "光合成", generate_tags: false })
      }.not_to have_enqueued_job(GenerateTagsJob)
    end

    it "不適切なプロンプトはアイテムを作らずジョブも積まずにブロックする" do
      expect {
        expect {
          described_class.call(user: user, params: { title: "a cute loli" })
        }.to raise_error(described_class::ContentBlocked)
      }.not_to change { user.items.count }

      expect(enqueued_jobs).to be_empty
    end

    it "カスタムプロンプトに違反語が含まれる場合もブロックする" do
      expect {
        described_class.call(user: user, params: { title: "cat", custom_prompt: "in a rape scene" })
      }.to raise_error(described_class::ContentBlocked)
    end

    it "consumes 1 credit (=100pt) per generation" do
      user.ensure_current_period_credits! # 先に無料枠を付与しておく
      expect {
        described_class.call(user: user, params: { title: "cat" })
      }.to change { user.reload.available_credit_points }.by(-Billing::POINTS_PER_CREDIT)
    end

    it "raises InsufficientCredits when the balance is exhausted" do
      # 無料枠を使い切らせる（10cr=1000pt を 0 に）
      user.ensure_current_period_credits!
      user.update!(subscription_credits: 0, topup_credits: 0)

      expect {
        described_class.call(user: user, params: { title: "no-credit" })
      }.to raise_error(described_class::InsufficientCredits)
    end
  end
end
