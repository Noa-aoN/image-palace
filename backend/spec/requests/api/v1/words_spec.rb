require "rails_helper"

RSpec.describe "Api::V1::Words", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "POST /api/v1/words/generate" do
    it "認証なしは 401" do
      post "/api/v1/words/generate", params: { theme: "果物", count: 3 }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "生成された単語を返す" do
      allow(GenerateWordsService).to receive(:call).and_return(%w[りんご バナナ])
      post "/api/v1/words/generate", params: { theme: "果物", count: 2 }, headers: headers, as: :json
      expect(response).to have_http_status(:success)
      expect(json_response["words"]).to eq(%w[りんご バナナ])
    end

    it "生成失敗時は 422" do
      allow(GenerateWordsService).to receive(:call).and_raise(GenerateWordsService::GenerationError)
      post "/api/v1/words/generate", params: { theme: "x" }, headers: headers, as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to be_present
    end
  end

  describe "POST /api/v1/words/check" do
    let(:result) do
      CheckWordsService::Result.new(
        issues: [ { word: "スパナ", verdict: "off_theme", reason: "果物ではありません", replacement: "ぶどう" } ],
        additions: %w[もも]
      )
    end

    it "認証なしは 401" do
      post "/api/v1/words/check", params: { theme: "果物", words: %w[りんご] }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "指摘と追加提案を返す" do
      allow(CheckWordsService).to receive(:call).and_return(result)

      post "/api/v1/words/check", params: { theme: "果物", words: %w[りんご スパナ] }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["issues"].first).to include(
        "word" => "スパナ", "verdict" => "off_theme", "replacement" => "ぶどう"
      )
      expect(json_response["additions"]).to eq(%w[もも])
    end

    it "点検失敗時は 422" do
      allow(CheckWordsService).to receive(:call).and_raise(CheckWordsService::GenerationError)

      post "/api/v1/words/check", params: { theme: "x", words: %w[a] }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to be_present
    end
  end
end
