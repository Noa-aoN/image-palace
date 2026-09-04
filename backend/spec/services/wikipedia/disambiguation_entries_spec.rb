require "rails_helper"

# 多義語の行き止まりを無くす。
#
# 「アポロン」を引くと曖昧さ回避ページが返る。それを選ぶと
# 「その記事は引けませんでした」で終わっていた。
# 曖昧さ回避ページは「どれですか」と訊いている一覧なので、そのまま選択肢にする。
RSpec.describe Wikipedia::DisambiguationEntries do
  let(:body) do
    {
      "query" => {
        "pages" => [
          { "index" => 3, "title" => "アポロン (曲)", "description" => "楽曲" },
          { "index" => 1, "title" => "アポローン", "description" => "ギリシア神話の神",
            "thumbnail" => { "source" => "https://upload.wikimedia.org/apollo.jpg" } },
          { "index" => 2, "title" => "アポロ計画", "description" => "アメリカの有人宇宙飛行計画" }
        ]
      }
    }
  end

  def stub_api(payload: nil, raise_error: nil)
    connection = instance_double(Faraday::Connection)
    allow(Faraday).to receive(:new).and_return(connection)
    if raise_error
      allow(connection).to receive(:get).and_raise(raise_error)
    else
      allow(connection).to receive(:get).and_return(instance_double(Faraday::Response, body: payload))
    end
    connection
  end

  # Rails.cache は test では :null_store。書いても読めないため入れ替える
  before do
    @cache = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
  end

  after { Rails.cache = @cache }

  describe "一覧を取り出す" do
    before { stub_api(payload: body) }

    it "ページに書かれている順で返す（上から主要な意味が並んでいる）" do
      result = described_class.call("アポロン", language_code: "ja")

      expect(result.candidates.map(&:title)).to eq([ "アポローン", "アポロ計画", "アポロン (曲)" ])
    end

    it "説明文と画像も返す（題だけでは見分けられない）" do
      result = described_class.call("アポロン", language_code: "ja")

      expect(result.candidates.first.description).to eq("ギリシア神話の神")
      expect(result.candidates.first.thumbnail_url).to eq("https://upload.wikimedia.org/apollo.jpg")
    end
  end

  describe "選べないものを出さない" do
    it "まだ書かれていない記事を外す" do
      stub_api(payload: { "query" => { "pages" => [
        { "index" => 1, "title" => "アポローン" },
        { "index" => 2, "title" => "未執筆の項目", "missing" => true }
      ] } })

      result = described_class.call("アポロン", language_code: "ja")

      expect(result.candidates.map(&:title)).to eq([ "アポローン" ])
    end

    # 選んでも同じ画面に戻るだけになる
    it "また別の曖昧さ回避ページを外す" do
      stub_api(payload: { "query" => { "pages" => [
        { "index" => 1, "title" => "アポローン", "description" => "ギリシア神話の神" },
        { "index" => 2, "title" => "アポロ", "description" => "ウィキメディアの曖昧さ回避ページ" }
      ] } })

      result = described_class.call("アポロン", language_code: "ja")

      expect(result.candidates.map(&:title)).to eq([ "アポローン" ])
    end

    it "自分自身を外す" do
      stub_api(payload: { "query" => { "pages" => [
        { "index" => 1, "title" => "アポロン" },
        { "index" => 2, "title" => "アポローン" }
      ] } })

      result = described_class.call("アポロン", language_code: "ja")

      expect(result.candidates.map(&:title)).to eq([ "アポローン" ])
    end

    it "並べすぎない（選ぶのが仕事にならないように）" do
      pages = 40.times.map { |i| { "index" => i, "title" => "項目#{i}" } }
      stub_api(payload: { "query" => { "pages" => pages } })

      result = described_class.call("アポロン", language_code: "ja")

      expect(result.candidates.size).to eq(described_class::LIMIT)
    end
  end

  describe "落ちても壊さない" do
    it "通信に失敗しても空で返す（例外を投げない）" do
      stub_api(raise_error: Faraday::ConnectionFailed.new("boom"))

      result = described_class.call("アポロン", language_code: "ja")

      expect(result.candidates).to eq([])
    end

    it "記事へのリンクが1つも無いページでも空で返す" do
      stub_api(payload: { "batchcomplete" => true })

      expect(described_class.call("アポロン", language_code: "ja").candidates).to eq([])
    end

    it "題が空なら引きに行かない" do
      connection = stub_api(payload: body)

      described_class.call("  ", language_code: "ja")

      expect(connection).not_to have_received(:get)
    end
  end

  describe "覚えておく" do
    it "同じ題は2度引かない" do
      connection = stub_api(payload: body)

      2.times { described_class.call("アポロン", language_code: "ja") }

      expect(connection).to have_received(:get).once
    end

    it "言語が違えば引き直す（日本語版の一覧を英語版に返さない）" do
      connection = stub_api(payload: body)

      described_class.call("Apollo", language_code: "ja")
      described_class.call("Apollo", language_code: "en")

      expect(connection).to have_received(:get).twice
    end
  end
end
