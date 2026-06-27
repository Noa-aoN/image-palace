require "rails_helper"

RSpec.describe "Api::V1::Wordlists", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  it "認証なしは 401" do
    get "/api/v1/wordlists", as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "作成時に空白・重複を除去して保存する" do
    post "/api/v1/wordlists",
      params: { wordlist: { name: "果物", words: [ "りんご", "りんご", " ", "バナナ" ] } },
      headers: headers, as: :json

    expect(response).to have_http_status(:created)
    expect(json_response["words"]).to eq(%w[りんご バナナ])
    expect(json_response["word_count"]).to eq(2)
  end

  it "name が無いと 422" do
    post "/api/v1/wordlists", params: { wordlist: { name: "", words: [] } }, headers: headers, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(json_response["errors"]).to be_present
  end

  it "自分のワードリスト一覧を返す" do
    user.wordlists.create!(name: "果物", words: %w[りんご])
    get "/api/v1/wordlists", headers: headers, as: :json
    expect(json_response.size).to eq(1)
    expect(json_response.first["name"]).to eq("果物")
  end

  it "他人のワードリストは参照できない（404）" do
    other = create(:user, :confirmed)
    wl = other.wordlists.create!(name: "他人のリスト", words: %w[x])
    get "/api/v1/wordlists/#{wl.id}", headers: headers, as: :json
    expect(response).to have_http_status(:not_found)
  end

  it "削除できる" do
    wl = user.wordlists.create!(name: "果物", words: %w[りんご])
    delete "/api/v1/wordlists/#{wl.id}", headers: headers, as: :json
    expect(response).to have_http_status(:no_content)
    expect(user.wordlists.count).to eq(0)
  end
end
