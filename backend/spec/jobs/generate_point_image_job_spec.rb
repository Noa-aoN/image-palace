require "rails_helper"

RSpec.describe GeneratePointImageJob, type: :job do
  let(:user) { create(:user, :confirmed) }
  let(:space) { create(:space, :road, user: user) }
  let(:point) { create(:space_point, space: space, name: "玄関", generation_status: "pending") }

  describe "#perform" do
    it "attaches the cached image on cache hit without calling the generator" do
      normalized = NormalizePromptService.call(point.name)
      create(:shared_media, :with_file, user: user, normalized_prompt: normalized)
      allow(GenerateImageService).to receive(:call)

      described_class.new.perform(point.id)

      point.reload
      expect(point.generation_status).to eq("completed")
      expect(point.image).to be_attached
      expect(GenerateImageService).not_to have_received(:call)
    end

    it "generates and attaches a new image on cache miss" do
      result = GenerateImageService::Result.new(
        image_data: "\x89PNG\r\n\x1A\nfake-png-bytes",
        content_type: "image/png",
        metadata: { "provider" => "openai", "revised_prompt" => "a vivid 玄関" }
      )
      allow(GenerateImageService).to receive(:call).and_return(result)

      described_class.new.perform(point.id)

      point.reload
      expect(GenerateImageService).to have_received(:call).with(prompt: "玄関")
      expect(point.generation_status).to eq("completed")
      expect(point.image).to be_attached
      expect(point.revised_prompt).to eq("a vivid 玄関")
    end

    it "marks failed on a non-retryable bad request" do
      allow(GenerateImageService).to receive(:call).and_raise(Faraday::BadRequestError.new("400 Bad Request"))

      described_class.new.perform(point.id)

      point.reload
      expect(point.generation_status).to eq("failed")
      expect(point.generation_error).to be_present
    end

    it "does nothing when the point has no name" do
      nameless = create(:space_point, space: space, name: nil)

      described_class.new.perform(nameless.id)

      expect(nameless.reload.image).not_to be_attached
    end
  end

  describe "#mark_failed!" do
    it "stores a user-facing message for network errors" do
      described_class.new.send(:mark_failed!, point.id, Faraday::TimeoutError.new("timeout"))

      expect(point.reload.generation_error).to include("通信が不安定")
    end

    it "stores the operator-contact message for billing limit errors" do
      error = Faraday::BadRequestError.new(
        "400 Bad Request",
        { status: 400, body: { "error" => { "code" => "billing_hard_limit_reached" } } }
      )

      described_class.new.send(:mark_failed!, point.id, error)

      expect(point.reload.generation_error).to include("一時的に利用できません")
    end
  end
end
