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
end
