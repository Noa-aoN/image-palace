require "rails_helper"

RSpec.describe ImageGenerators::Flux do
  subject(:generator) { described_class.new }

  around do |example|
    original = ENV["FAL_API_KEY"]
    ENV["FAL_API_KEY"] = "test-key"
    example.run
    ENV["FAL_API_KEY"] = original
  end

  # 実際の connection と同じミドルウェア構成（json → raise_error）でテストアダプタを差し込む。
  def stub_connection(status:, body:)
    stubs = Faraday::Adapter::Test::Stubs.new
    stubs.post(generator.model) do
      [ status, { "Content-Type" => "application/json" }, body.to_json ]
    end
    conn = Faraday.new do |f|
      f.request :json
      f.response :json
      f.response :raise_error
      f.adapter :test, stubs
    end
    allow(generator).to receive(:connection).and_return(conn)
  end

  describe "#generate" do
    it "fal.ai のレスポンスから共通契約を返す" do
      body = {
        "images" => [ { "url" => "https://fal.example/out.png", "content_type" => "image/png" } ],
        "seed" => 42
      }
      stub_connection(status: 200, body: body)
      allow(generator).to receive(:download).with("https://fal.example/out.png").and_return("binary-bytes")

      result = generator.generate(prompt: "a cute otter, watercolor")

      expect(result[:image_data]).to eq("binary-bytes")
      expect(result[:content_type]).to eq("image/png")
      expect(result[:metadata][:provider]).to eq("flux")
      expect(result[:metadata][:model]).to eq("fal-ai/flux/schnell")
      expect(result[:metadata][:seed]).to eq(42)
    end

    it "content_type が無ければ image/png にフォールバックする" do
      stub_connection(status: 200, body: { "images" => [ { "url" => "https://fal.example/out" } ] })
      allow(generator).to receive(:download).and_return("bytes")

      expect(generator.generate(prompt: "x")[:content_type]).to eq("image/png")
    end

    it "画像 URL が無ければ例外を投げる" do
      stub_connection(status: 200, body: { "images" => [] })

      expect { generator.generate(prompt: "x") }.to raise_error(/画像データ/)
    end

    it "400 は Faraday::BadRequestError として伝播する（ジョブ側で即 failed になる）" do
      stub_connection(status: 400, body: { "detail" => "invalid prompt" })

      expect { generator.generate(prompt: "x") }.to raise_error(Faraday::BadRequestError)
    end
  end

  describe "#model" do
    it "FAL_IMAGE_MODEL で上書きできる" do
      original = ENV["FAL_IMAGE_MODEL"]
      ENV["FAL_IMAGE_MODEL"] = "fal-ai/flux/dev"
      expect(generator.model).to eq("fal-ai/flux/dev")
    ensure
      ENV["FAL_IMAGE_MODEL"] = original
    end

    it "既定は schnell" do
      expect(generator.model).to eq("fal-ai/flux/schnell")
    end
  end
end
