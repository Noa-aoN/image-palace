require "rails_helper"

RSpec.describe GenerateImageJob, type: :job do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, :processing, user: user, title: "aaaaaaa") }

  describe "#mark_failed!" do
    it "stores a user friendly error for invalid prompts" do
      error = Faraday::BadRequestError.new("400 Bad Request")

      described_class.new.send(:mark_failed!, item.id, error)

      item.reload
      expect(item.generation_status).to eq("failed")
      expect(item.generation_error_code).to eq("Faraday::BadRequestError")
      expect(item.generation_error).to eq("入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。")
    end

    it "コンテンツポリシー違反の 400 には専用メッセージを保存する" do
      error = Faraday::BadRequestError.new("400 Bad Request: your request was rejected by the safety system (moderation_blocked)")

      described_class.new.send(:mark_failed!, item.id, error)

      item.reload
      expect(item.generation_status).to eq("failed")
      expect(item.generation_error).to eq("入力がコンテンツポリシーに反するため画像を生成できませんでした。別の単語でお試しください。")
    end

    it "stores a retry hint for network failures" do
      error = Faraday::SSLError.new("SSL_read: unexpected eof while reading")

      described_class.new.send(:mark_failed!, item.id, error)

      item.reload
      expect(item.generation_status).to eq("failed")
      expect(item.generation_error_code).to eq("Faraday::SSLError")
      expect(item.generation_error).to eq("通信が不安定だったため画像を生成できませんでした。時間を置いて再試行してください。")
    end

    it "請求上限（billing hard limit）には運営者問い合わせ用メッセージを保存する" do
      error = Faraday::BadRequestError.new(
        "400 Bad Request",
        { status: 400, body: { "error" => { "code" => "billing_hard_limit_reached" } } }
      )

      described_class.new.send(:mark_failed!, item.id, error)

      item.reload
      expect(item.generation_status).to eq("failed")
      expect(item.generation_error).to eq(
        "現在、画像生成を一時的に利用できません。時間をおいて再度お試しいただくか、運営者にお問い合わせください。"
      )
    end
  end

  describe "リトライ制御" do
    it "請求上限エラーはリトライせず即 failed にする" do
      error = Faraday::BadRequestError.new(
        "400 Bad Request",
        { status: 400, body: { "error" => { "code" => "billing_hard_limit_reached" } } }
      )
      allow(GenerateImageService).to receive(:call).and_raise(error)

      expect {
        described_class.perform_now(item.id)
      }.not_to have_enqueued_job(GenerateImageJob)

      expect(item.reload.generation_status).to eq("failed")
    end

    it "通信エラーはリトライする（再エンキューされる）" do
      allow(GenerateImageService).to receive(:call).and_raise(Faraday::TimeoutError.new("timeout"))

      expect {
        described_class.perform_now(item.id)
      }.to have_enqueued_job(GenerateImageJob)
    end
  end

  describe ".perform_now" do
    it "clears stale generation_error when cached media completes the item" do
      create(:shared_media, :with_file,
        user: user,
        normalized_prompt: NormalizePromptService.call(PromptBuilderService.effective_prompt(item)),
        metadata: { "provider" => "openai" })
      item.mark_generation_failed!(message: "古い失敗理由", code: "old_error")

      described_class.perform_now(item.id)

      item.reload
      expect(item.generation_status).to eq("completed")
      expect(item.generation_error).to be_nil
      expect(item.generation_error_code).to be_nil
      expect(item.primary_media.file).to be_attached
    end

    it "attaches the generated image bytes on cache miss" do
      result = GenerateImageService::Result.new(
        image_data: "\x89PNG\r\n\x1A\nfake-png-bytes",
        content_type: "image/png",
        metadata: { "provider" => "openai", "model" => "gpt-image-1" }
      )
      allow(GenerateImageService).to receive(:call).and_return(result)

      described_class.perform_now(item.id)

      item.reload
      expect(GenerateImageService).to have_received(:call).with(prompt: PromptBuilderService.effective_prompt(item))
      expect(item.generation_status).to eq("completed")
      expect(item.primary_media.file).to be_attached
      expect(item.primary_media.metadata["model"]).to eq("gpt-image-1")
    end

    it "生成画像を WebP に変換して保存する" do
      skip "libvips 未インストール環境のためスキップ" unless vips_available?

      png = Vips::Image.black(1024, 1024).pngsave_buffer
      result = GenerateImageService::Result.new(
        image_data: png,
        content_type: "image/png",
        metadata: { "provider" => "openai", "model" => "gpt-image-1" }
      )
      allow(GenerateImageService).to receive(:call).and_return(result)

      described_class.perform_now(item.id)

      blob = item.reload.primary_media.file.blob
      expect(blob.content_type).to eq("image/webp")
      expect(blob.filename.to_s).to end_with(".webp")
    end

    it "スタイル指定がある場合は有効プロンプト（スタイル修飾込み）で生成する" do
      styled = create(:item, :processing, user: user, title: "cat", style: "watercolor")
      result = GenerateImageService::Result.new(
        image_data: "\x89PNG\r\n\x1A\nfake", content_type: "image/png", metadata: {}
      )
      allow(GenerateImageService).to receive(:call).and_return(result)

      described_class.perform_now(styled.id)

      expect(GenerateImageService).to have_received(:call) do |prompt:|
        expect(prompt).to include("cat")
        expect(prompt).to include("watercolor")
      end
    end

    it "同一タイトルでもスタイルが違えば別キャッシュ（既存の素の画像を再利用しない）" do
      # 素のタイトル "cat" のキャッシュを用意
      create(:shared_media, :with_file,
        user: user,
        normalized_prompt: NormalizePromptService.call("cat"),
        metadata: {})
      styled = create(:item, :processing, user: user, title: "cat", style: "anime")
      result = GenerateImageService::Result.new(
        image_data: "\x89PNG\r\n\x1A\nfake", content_type: "image/png", metadata: {}
      )
      allow(GenerateImageService).to receive(:call).and_return(result)

      described_class.perform_now(styled.id)

      # スタイル付きは別キーなのでキャッシュHITせず生成が呼ばれる
      expect(GenerateImageService).to have_received(:call)
    end
  end
end
