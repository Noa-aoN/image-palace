require "rails_helper"

RSpec.describe GenerateAvatarJob, type: :job do
  let(:user) { create(:user, :confirmed) }

  def stub_generation(image_data: "\x89PNG\r\n\x1A\nfake-png-bytes")
    result = GenerateImageService::Result.new(
      image_data: image_data,
      content_type: "image/png",
      metadata: { "provider" => "openai" }
    )
    allow(GenerateImageService).to receive(:call).and_return(result)
  end

  describe "#perform" do
    it "generates and attaches the avatar, marking completed" do
      stub_generation

      described_class.new.perform(user.id, "a cute robot", "photo")

      user.reload
      expect(GenerateImageService).to have_received(:call)
      expect(user.avatar_generation_status).to eq("completed")
      expect(user.avatar).to be_attached
    end

    it "applies the style modifier and no-text hint to the prompt" do
      stub_generation

      described_class.new.perform(user.id, "robot", "photo")

      expect(GenerateImageService).to have_received(:call).with(
        hash_including(
          prompt: a_string_including("robot")
            .and(a_string_including(PromptBuilderService::STYLE_MODIFIERS["photo"]))
            .and(a_string_including(PromptBuilderService::NO_TEXT_HINT))
        )
      )
    end

    it "marks failed on a non-retryable bad request" do
      allow(GenerateImageService).to receive(:call).and_raise(Faraday::BadRequestError.new("400 Bad Request"))

      described_class.new.perform(user.id, "robot", nil)

      user.reload
      expect(user.avatar_generation_status).to eq("failed")
      expect(user.avatar_generation_error).to be_present
    end

    it "does nothing when the prompt is blank" do
      described_class.new.perform(user.id, "   ", nil)

      expect(user.reload.avatar).not_to be_attached
    end
  end

  describe "#mark_failed!" do
    it "stores a user-facing message for network errors" do
      described_class.new.send(:mark_failed!, user.id, Faraday::TimeoutError.new("timeout"))

      expect(user.reload.avatar_generation_error).to include("通信が不安定")
    end
  end
end
