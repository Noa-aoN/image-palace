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

  describe "GET /api/v1/wikipedia/search" do
    def stub_search(candidates)
      allow(Wikipedia::CandidateSearch).to receive(:call).and_return(
        Wikipedia::CandidateSearch::Result.new(
          candidates: candidates.map { |c| Wikipedia::CandidateSearch::Candidate.new(**c) },
          language_code: "en"
        )
      )
    end

    it "題・説明文・画像を返す" do
      stub_search([
        { title: "Mycenaean Greece", description: "Late Bronze Age Greek civilization",
          thumbnail_url: "https://upload.wikimedia.org/t.jpg" }
      ])

      get "/api/v1/wikipedia/search", params: { q: "Mycenaean Greece", language_code: "en" }, headers: headers

      expect(response).to have_http_status(:ok)
      first = response.parsed_body["candidates"].first
      expect(first["title"]).to eq("Mycenaean Greece")
      expect(first["description"]).to eq("Late Bronze Age Greek civilization")
      expect(first["thumbnail_url"]).to eq("https://upload.wikimedia.org/t.jpg")
      expect(response.parsed_body["language_code"]).to eq("en")
    end

    # 一番上を勝手に採ると、同名の別人・別作品が黙って card に入る
    it "候補を返すだけで、カードには何も保存しない" do
      stub_search([ { title: "Mycenaean Greece", description: "x", thumbnail_url: nil } ])

      expect { get "/api/v1/wikipedia/search", params: { q: "Mycenaean" }, headers: headers }
        .not_to change(ItemProperty, :count)
    end

    it "語をかすっていれば weak にしない" do
      stub_search([ { title: "Mycenaean Greece", description: "x", thumbnail_url: nil } ])

      get "/api/v1/wikipedia/search", params: { q: "Mycenaean", language_code: "en" }, headers: headers

      expect(response.parsed_body["weak"]).to be(false)
      expect(response.parsed_body["message"]).to be_nil
    end

    # 候補は消さない。表記が違うだけの正解を捨てないため
    it "どれも語を含まなければ、候補は出しつつ言い直しを勧める" do
      stub_search([ { title: "全然ちがう記事", description: "x", thumbnail_url: nil } ])

      get "/api/v1/wikipedia/search", params: { q: "光合成" }, headers: headers

      expect(response.parsed_body["weak"]).to be(true)
      expect(response.parsed_body["candidates"].size).to eq(1)
      expect(response.parsed_body["message"]).to include("より具体的な語")
    end

    it "候補が無ければ、別の語を勧める" do
      stub_search([])

      get "/api/v1/wikipedia/search", params: { q: "存在しない語" }, headers: headers

      expect(response.parsed_body["weak"]).to be(true)
      expect(response.parsed_body["candidates"]).to eq([])
      expect(response.parsed_body["message"]).to include("別の語")
    end

    it "認証が要る" do
      get "/api/v1/wikipedia/search", params: { q: "何か" }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
