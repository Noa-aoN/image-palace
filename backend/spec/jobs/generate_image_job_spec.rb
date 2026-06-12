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

    it "stores a retry hint for network failures" do
      error = Faraday::SSLError.new("SSL_read: unexpected eof while reading")

      described_class.new.send(:mark_failed!, item.id, error)

      item.reload
      expect(item.generation_status).to eq("failed")
      expect(item.generation_error_code).to eq("Faraday::SSLError")
      expect(item.generation_error).to eq("通信が不安定だったため画像を生成できませんでした。時間を置いて再試行してください。")
    end
  end

  describe ".perform_now" do
    it "clears stale generation_error when cached media completes the item" do
      create(:shared_media, :with_file,
        user: user,
        normalized_prompt: NormalizePromptService.call(item.title),
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
      expect(GenerateImageService).to have_received(:call).with(prompt: item.title)
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
  end
end
