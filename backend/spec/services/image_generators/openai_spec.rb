require "rails_helper"

RSpec.describe ImageGenerators::Openai do
  subject(:generator) { described_class.new }

  around do |example|
    original = ENV["OPENAI_API_KEY"]
    ENV["OPENAI_API_KEY"] = "test-key"
    example.run
    ENV["OPENAI_API_KEY"] = original
  end

  def stub_openai(response)
    images = double("images")
    allow(images).to receive(:generate).and_return(response)
    allow(OpenAI::Client).to receive(:new).and_return(double("client", images: images))
    images
  end

  describe "#generate" do
    it "b64_json レスポンスから共通契約を返す" do
      b64 = Base64.strict_encode64("png-bytes")
      stub_openai({ "data" => [ { "b64_json" => b64, "revised_prompt" => "a vivid apple" } ] })

      result = generator.generate(prompt: "apple")

      expect(result[:image_data]).to eq("png-bytes")
      expect(result[:content_type]).to eq("image/png")
      expect(result[:metadata][:provider]).to eq("openai")
      expect(result[:metadata][:model]).to eq("gpt-image-1")
      expect(result[:metadata][:revised_prompt]).to eq("a vivid apple")
    end

    it "url レスポンスは download して返す" do
      stub_openai({ "data" => [ { "url" => "https://oai.example/x.png" } ] })
      allow(generator).to receive(:download).with("https://oai.example/x.png").and_return("downloaded")

      expect(generator.generate(prompt: "apple")[:image_data]).to eq("downloaded")
    end

    it "画像データが無ければ例外を投げる" do
      stub_openai({ "data" => [ {} ] })

      expect { generator.generate(prompt: "x") }.to raise_error(/画像データ/)
    end

    it "指定パラメータで OpenAI を呼ぶ" do
      images = stub_openai({ "data" => [ { "b64_json" => Base64.strict_encode64("x") } ] })

      generator.generate(prompt: "apple")

      expect(images).to have_received(:generate).with(
        parameters: hash_including(model: "gpt-image-1", prompt: "apple", size: "1024x1024", quality: "medium", n: 1)
      )
    end
  end

  describe "#model" do
    it "OPENAI_IMAGE_MODEL で上書きできる" do
      original = ENV["OPENAI_IMAGE_MODEL"]
      ENV["OPENAI_IMAGE_MODEL"] = "gpt-image-1.5"
      expect(generator.model).to eq("gpt-image-1.5")
    ensure
      ENV["OPENAI_IMAGE_MODEL"] = original
    end
  end
end
