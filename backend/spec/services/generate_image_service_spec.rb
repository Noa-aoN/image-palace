require "rails_helper"

RSpec.describe GenerateImageService do
  around do |example|
    original = ENV["IMAGE_GENERATION_PROVIDER"]
    example.run
    ENV["IMAGE_GENERATION_PROVIDER"] = original
  end

  def set_provider(name)
    if name.nil?
      ENV.delete("IMAGE_GENERATION_PROVIDER")
    else
      ENV["IMAGE_GENERATION_PROVIDER"] = name
    end
  end

  describe ".generator_class / .provider_name" do
    it "既定は openai" do
      set_provider(nil)
      expect(described_class.provider_name).to eq("openai")
      expect(described_class.generator_class).to eq(ImageGenerators::Openai)
    end

    it "IMAGE_GENERATION_PROVIDER=flux で Flux を解決する" do
      set_provider("flux")
      expect(described_class.generator_class).to eq(ImageGenerators::Flux)
    end

    it "未対応のプロバイダーは ArgumentError" do
      set_provider("unknown")
      expect { described_class.generator_class }.to raise_error(ArgumentError, /未対応のプロバイダー/)
    end
  end

  describe ".namespaced_cache_key" do
    it "既定(openai/gpt-image-1)は後方互換で素の normalized を返す（既存キャッシュ維持）" do
      set_provider(nil)
      expect(described_class.namespaced_cache_key("apple")).to eq("apple")
    end

    it "非既定プロバイダは provider:model で名前空間化する" do
      set_provider("flux")
      expect(described_class.namespaced_cache_key("apple")).to eq("flux:fal-ai/flux/schnell:apple")
    end

    it "同じ openai でもモデルが変われば名前空間化する" do
      set_provider("openai")
      original = ENV["OPENAI_IMAGE_MODEL"]
      ENV["OPENAI_IMAGE_MODEL"] = "gpt-image-1.5"
      expect(described_class.namespaced_cache_key("apple")).to eq("openai:gpt-image-1.5:apple")
    ensure
      ENV["OPENAI_IMAGE_MODEL"] = original
    end
  end

  describe ".call" do
    it "選択された generator に委譲し Result を返す" do
      set_provider("flux")
      fake = instance_double(ImageGenerators::Flux, generate: {
        image_data: "bytes", content_type: "image/png", metadata: { provider: "flux" }
      })
      allow(ImageGenerators::Flux).to receive(:new).and_return(fake)

      result = described_class.call(prompt: "otter")

      expect(result).to be_a(GenerateImageService::Result)
      expect(result.image_data).to eq("bytes")
      expect(result.metadata[:provider]).to eq("flux")
    end
  end
end
