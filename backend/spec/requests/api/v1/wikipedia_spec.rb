require "rails_helper"

RSpec.describe "Wikipedia の引き当て", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  def stub_fetch(result)
    allow(Wikipedia::SummaryFetcher).to receive(:call).and_return(result)
  end

  it "引けたら、冒頭と記事URLを返す" do
    stub_fetch(
      Wikipedia::SummaryFetcher::Result.new(
        title: "アレクサンドロス3世", url: "https://ja.wikipedia.org/wiki/x",
        extract: "マケドニア王国の国王。", thumbnail_url: nil, lang: "ja",
        type: "standard", fetched_at: Time.current
      )
    )

    get "/api/v1/wikipedia/summary", params: { q: "アレクサンドロス3世" }, headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["found"]).to be(true)
    expect(response.parsed_body.dig("summary", "url")).to eq("https://ja.wikipedia.org/wiki/x")
    expect(response.parsed_body["disambiguation"]).to be(false)
  end

  # Wikipedia が落ちているのはこちらの不具合ではない。
  # 5xx を返すと、画面が「壊れた」と見せることになる
  it "引けなくても 200 で返す" do
    stub_fetch(nil)

    get "/api/v1/wikipedia/summary", params: { q: "存在しない語" }, headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["found"]).to be(false)
    expect(response.parsed_body["message"]).to be_present
  end

  it "曖昧さ回避のページはそれと分かる形で返す" do
    stub_fetch(
      Wikipedia::SummaryFetcher::Result.new(
        title: "アポロ", url: "https://ja.wikipedia.org/wiki/y", extract: "曖昧さ回避",
        thumbnail_url: nil, lang: "ja", type: "disambiguation", fetched_at: Time.current
      )
    )

    get "/api/v1/wikipedia/summary", params: { q: "アポロ" }, headers: headers

    expect(response.parsed_body["disambiguation"]).to be(true)
  end

  it "ログインしていなければ引けない" do
    get "/api/v1/wikipedia/summary", params: { q: "語" }

    expect(response).to have_http_status(:unauthorized)
  end
end
