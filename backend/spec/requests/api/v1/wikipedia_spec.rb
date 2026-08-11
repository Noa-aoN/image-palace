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
        page_id: 1, title: "アレクサンドロス3世", description: "国王",
        url: "https://ja.wikipedia.org/wiki/x",
        extract: "マケドニア王国の国王。", thumbnail_url: nil, language_code: "ja",
        type: "standard", fetched_at: Time.current
      )
    )

    get "/api/v1/wikipedia/summary", params: { q: "アレクサンドロス3世" }, headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["found"]).to be(true)
    expect(response.parsed_body.dig("summary", "wikipedia_url")).to eq("https://ja.wikipedia.org/wiki/x")
    expect(response.parsed_body.dig("summary", "wikipedia_language_code")).to eq("ja")
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
        page_id: 2, title: "アポロ", url: "https://ja.wikipedia.org/wiki/y", extract: "曖昧さ回避",
        thumbnail_url: nil, language_code: "ja", type: "disambiguation", fetched_at: Time.current
      )
    )

    get "/api/v1/wikipedia/summary", params: { q: "アポロ" }, headers: headers

    expect(response.parsed_body["disambiguation"]).to be(true)
  end

  describe "言語" do
    # いまは画面に選択を出していないが、渡せる形にはしておく。
    # あとから足すと、保存済みの値がどの言語のものか分からなくなる
    it "指定された言語で引く" do
      allow(Wikipedia::SummaryFetcher).to receive(:call).and_return(nil)

      get "/api/v1/wikipedia/summary", params: { q: "Alexander", language_code: "en" }, headers: headers

      expect(Wikipedia::SummaryFetcher).to have_received(:call).with("Alexander", language_code: "en")
      expect(response.parsed_body["language_code"]).to eq("en")
    end

    it "指定が無ければ、利用者の表示言語を見る" do
      user.setting&.update!(locale: "en") || Setting.create!(user: user, locale: "en")
      allow(Wikipedia::SummaryFetcher).to receive(:call).and_return(nil)

      get "/api/v1/wikipedia/summary", params: { q: "Alexander" }, headers: headers

      expect(Wikipedia::SummaryFetcher).to have_received(:call).with("Alexander", language_code: "en")
    end

    it "どこにも無ければ ja" do
      allow(Wikipedia::SummaryFetcher).to receive(:call).and_return(nil)

      get "/api/v1/wikipedia/summary", params: { q: "語" }, headers: headers

      expect(Wikipedia::SummaryFetcher).to have_received(:call).with("語", language_code: "ja")
    end
  end

  it "ログインしていなければ引けない" do
    get "/api/v1/wikipedia/summary", params: { q: "語" }

    expect(response).to have_http_status(:unauthorized)
  end
end
