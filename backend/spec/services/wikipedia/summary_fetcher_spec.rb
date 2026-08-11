require "rails_helper"

RSpec.describe Wikipedia::SummaryFetcher do
  let(:term) { "アレクサンドロス3世" }

  let(:body) do
    {
      "pageid" => 12345,
      "description" => "マケドニア王国の国王",
      "title" => "アレクサンドロス3世",
      "type" => "standard",
      "extract" => "マケドニア王国の国王。" * 60,
      "content_urls" => { "desktop" => { "page" => "https://ja.wikipedia.org/wiki/..." } },
      "thumbnail" => { "source" => "https://upload.wikimedia.org/thumb.jpg" }
    }
  end

  def stub_request_with(status: 200, payload: nil, raise_error: nil)
    connection = instance_double(Faraday::Connection)
    allow(Faraday).to receive(:new).and_return(connection)
    if raise_error
      allow(connection).to receive(:get).and_raise(raise_error)
    else
      allow(connection).to receive(:get).and_return(
        instance_double(Faraday::Response, body: payload, status: status)
      )
    end
    connection
  end

  before { Rails.cache.clear }

  describe "取れたとき" do
    before { stub_request_with(payload: body) }

    it "冒頭・題名・記事URL・画像のURLを返す" do
      result = described_class.call(term)

      expect(result.title).to eq("アレクサンドロス3世")
      expect(result.page_id).to eq(12345)
      expect(result.description).to eq("マケドニア王国の国王")
      expect(result.url).to eq("https://ja.wikipedia.org/wiki/...")
      expect(result.thumbnail_url).to eq("https://upload.wikimedia.org/thumb.jpg")
      expect(result.language_code).to eq("ja")
    end

    # 保存の鍵は wikipedia_ を付ける。カードの項目に混ぜたとき、
    # 名前だけでどこから来た値かが分かるように
    it "保存する形は wikipedia_ で始まる鍵で返す" do
      expect(described_class.call(term).to_h.keys).to include(
        "wikipedia_page_id", "wikipedia_title", "wikipedia_url",
        "wikipedia_extract", "wikipedia_thumbnail_url", "wikipedia_language_code",
        "wikipedia_fetched_at"
      )
    end

    # 長文は保存しない方針。冒頭だけを持ち、続きは記事へ渡す
    it "冒頭は決めた長さで切る" do
      expect(described_class.call(term).extract.length).to eq(described_class::MAX_EXTRACT_LENGTH)
    end

    it "曖昧さ回避のページはそれと分かる" do
      allow(Faraday).to receive(:new).and_return(
        instance_double(Faraday::Connection, get: instance_double(
          Faraday::Response, body: body.merge("type" => "disambiguation"), status: 200
        ))
      )

      expect(described_class.call(term)).to be_disambiguation
    end
  end

  describe "取れなかったとき" do
    # ここで例外を投げると、カードを開くことも直すこともできなくなる
    it "落ちていても nil を返すだけ（例外を投げない）" do
      stub_request_with(raise_error: Faraday::TimeoutError.new("timeout"))

      expect { expect(described_class.call(term)).to be_nil }.not_to raise_error
    end

    it "記事が無ければ nil" do
      stub_request_with(raise_error: Faraday::ResourceNotFound.new("not found"))

      expect(described_class.call(term)).to be_nil
    end

    it "空の語は問い合わせずに nil" do
      expect(Faraday).not_to receive(:new)

      expect(described_class.call("  ")).to be_nil
    end

    # 次に開いたときは繋がるかもしれない。失敗を覚え込ませない
    it "失敗はキャッシュしない" do
      Rails.cache = ActiveSupport::Cache::MemoryStore.new
      stub_request_with(raise_error: Faraday::TimeoutError.new("timeout"))
      described_class.call(term)

      connection = stub_request_with(payload: body)
      expect(described_class.call(term).title).to eq("アレクサンドロス3世")
      expect(connection).to have_received(:get)
    end
  end

  describe "キャッシュ" do
    # test 環境の Rails.cache は null_store（何も覚えない）ので、ここだけ差し替える。
    # 覚える置き場が無いと、キャッシュしているかを確かめようがない
    around do |example|
      original = Rails.cache
      Rails.cache = ActiveSupport::Cache::MemoryStore.new
      example.run
      Rails.cache = original
    end

    it "同じ語は1回しか引かない" do
      connection = stub_request_with(payload: body)

      2.times { described_class.call(term) }

      expect(connection).to have_received(:get).once
    end
  end

  describe "言語" do
    # いまは日本語しか出していないが、言語を持たない形では作らない。
    # あとから足すと、保存済みの値がどの言語のものか分からなくなる
    it "既定は ja" do
      stub_request_with(payload: body)

      expect(described_class.call(term).language_code).to eq("ja")
    end

    it "指定した言語版を引く" do
      allow(Faraday).to receive(:new).and_return(
        instance_double(Faraday::Connection, get: instance_double(Faraday::Response, body: body, status: 200))
      )

      described_class.call("Alexander", language_code: "en")

      expect(Faraday).to have_received(:new).with(hash_including(url: "https://en.wikipedia.org"))
    end

    it "引けない言語は既定に落とす（存在しないホストを叩きに行かない）" do
      allow(Faraday).to receive(:new).and_return(
        instance_double(Faraday::Connection, get: instance_double(Faraday::Response, body: body, status: 200))
      )

      described_class.call(term, language_code: "xx")

      expect(Faraday).to have_received(:new).with(hash_including(url: "https://ja.wikipedia.org"))
    end

    # 混ぜないと、日本語版で引いた値が英語版の求めに返ってしまう
    it "キャッシュの鍵に言語を混ぜる" do
      Rails.cache = ActiveSupport::Cache::MemoryStore.new
      connection = stub_request_with(payload: body)

      described_class.call(term, language_code: "ja")
      described_class.call(term, language_code: "en")

      expect(connection).to have_received(:get).twice
    end
  end

  describe "User-Agent" do
    # 連絡先の無いもの・ブラウザを騙るものは Wikimedia に弾かれる
    it "名乗りと連絡先を含む" do
      expect(described_class.user_agent).to start_with("ImagePalace/")
      expect(described_class.user_agent).to include("imagepalace.app")
    end
  end
end
