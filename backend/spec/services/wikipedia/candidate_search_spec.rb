require "rails_helper"

RSpec.describe Wikipedia::CandidateSearch do
  let(:body) do
    {
      "pages" => [
        { "title" => "Mycenaean", "description" => "Topics referred to by the same term" },
        { "title" => "Mycenaean Greece", "description" => "Late Bronze Age Greek civilization",
          "thumbnail" => { "url" => "//upload.wikimedia.org/thumb.jpg" } },
        { "title" => "Mycenaean Greek", "description" => "Earliest attested form of the Greek language" }
      ]
    }
  end

  def stub_search(payload: nil, raise_error: nil)
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

  describe "候補を並べる" do
    before { stub_search(payload: body) }

    it "題と説明文を返す" do
      result = described_class.call("Mycenaean", language_code: "en")

      expect(result.candidates.map(&:title)).to eq([ "Mycenaean", "Mycenaean Greece", "Mycenaean Greek" ])
      expect(result.candidates.second.description).to eq("Late Bronze Age Greek civilization")
    end

    # 題だけでは同名の別人・別作品を見分けられない。説明文が本体
    it "説明文が無い候補も落とさない" do
      stub_search(payload: { "pages" => [ { "title" => "説明の無い記事" } ] })

      result = described_class.call("説明の無い記事")

      expect(result.candidates.map(&:title)).to eq([ "説明の無い記事" ])
      expect(result.candidates.first.description).to be_nil
    end

    # 検索APIは `//upload...` で返すことがある。そのままでは読み込めない
    it "画像のURLに scheme を補う" do
      result = described_class.call("Mycenaean", language_code: "en")

      expect(result.candidates.second.thumbnail_url).to eq("https://upload.wikimedia.org/thumb.jpg")
    end

    it "題が無い候補は落とす" do
      stub_search(payload: { "pages" => [ { "title" => "", "description" => "題が無い" }, { "title" => "有効" } ] })

      expect(described_class.call("何か").candidates.map(&:title)).to eq([ "有効" ])
    end

    it "出す数に上限を置く" do
      stub_search(payload: { "pages" => Array.new(20) { |i| { "title" => "記事#{i}" } } })

      expect(described_class.call("記事").candidates.size).to eq(described_class::LIMIT)
    end
  end

  describe "弱い候補の判定" do
    it "語をかすっていれば弱くない" do
      stub_search(payload: body)

      result = described_class.call("Mycenaean", language_code: "en")

      expect(result.weak?("Mycenaean")).to be(false)
    end

    it "どれも語を含まなければ弱い" do
      stub_search(payload: { "pages" => [ { "title" => "全然ちがう記事" } ] })

      result = described_class.call("光合成")

      expect(result.weak?("光合成")).to be(true)
    end

    it "候補が無ければ弱い" do
      stub_search(payload: { "pages" => [] })

      expect(described_class.call("存在しない語").weak?("存在しない語")).to be(true)
    end

    # 表記が違うだけの正解を捨てない
    it "大文字小文字や空白の違いは同じものとして扱う" do
      stub_search(payload: { "pages" => [ { "title" => "New York City" } ] })

      result = described_class.call("new york city", language_code: "en")

      expect(result.weak?("new york city")).to be(false)
    end

    it "語を含む長い題も、かすっているとみなす" do
      stub_search(payload: { "pages" => [ { "title" => "ミトコンドリアDNA" } ] })

      expect(described_class.call("ミトコンドリア").weak?("ミトコンドリア")).to be(false)
    end
  end

  describe "引けなかったとき" do
    # ここで例外を投げると、カードを開くことも直すこともできなくなる
    it "落ちていても空で返す" do
      stub_search(raise_error: Faraday::TimeoutError.new("timeout"))

      result = described_class.call("何か")

      expect(result.candidates).to eq([])
      expect(result.language_code).to eq("ja")
    end

    it "空の語では問い合わせない" do
      expect(Faraday).not_to receive(:new)

      expect(described_class.call("  ").candidates).to eq([])
    end
  end

  describe "同じ語を何度も引かない" do
    it "2回目はキャッシュから返す" do
      connection = stub_search(payload: body)

      2.times { described_class.call("Mycenaean", language_code: "en") }

      expect(connection).to have_received(:get).once
    end

    # 日本語版で引いた候補が英語版の求めに返ってはいけない
    it "言語ごとに分けて覚える" do
      connection = stub_search(payload: body)

      described_class.call("Mycenaean", language_code: "en")
      described_class.call("Mycenaean", language_code: "ja")

      expect(connection).to have_received(:get).twice
    end
  end
end

# 題の検索は**先頭一致**（オートコンプリート用）なので、読みや言い換えには当たらない。
# 実測: 「アポロ計画」は4件返るが、「でぃーえぬえす」「ネットワークの通り道」は0件。
# 読みで書く人には、そこが行き止まりになっていた。
RSpec.describe "#{Wikipedia::CandidateSearch} の本文検索フォールバック" do
  let(:described_class) { Wikipedia::CandidateSearch }

  def page(title) = { "title" => title }

  # 経路ごとに違う結果を返す stub。どちらを引いたかも記録する
  def stub_paths(title_pages:, page_pages: [], page_raises: nil)
    connection = instance_double(Faraday::Connection)
    allow(Faraday).to receive(:new).and_return(connection)
    @paths = []
    allow(connection).to receive(:get) do |path, _params|
      @paths << path
      if path == described_class::PAGE_SEARCH_PATH
        raise page_raises if page_raises

        instance_double(Faraday::Response, body: { "pages" => page_pages })
      else
        instance_double(Faraday::Response, body: { "pages" => title_pages })
      end
    end
    connection
  end

  before do
    @cache = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
  end

  after { Rails.cache = @cache }

  # 当たっているときに混ぜると、関係の薄い記事が上位の正解を押しのける
  it "題で当たったら、本文までは引かない" do
    stub_paths(title_pages: [ page("アポロ計画"), page("アポロ計画陰謀論") ])

    result = described_class.call("アポロ計画")

    expect(result.candidates.map(&:title)).to eq([ "アポロ計画", "アポロ計画陰謀論" ])
    expect(@paths).to eq([ described_class::SEARCH_PATH ])
  end

  it "題が0件なら、本文まで見に行く" do
    stub_paths(title_pages: [], page_pages: [ page("ミトコンドリアDNA") ])

    result = described_class.call("みとこんどりあ")

    expect(result.candidates.map(&:title)).to eq([ "ミトコンドリアDNA" ])
    expect(@paths).to eq([ described_class::SEARCH_PATH, described_class::PAGE_SEARCH_PATH ])
  end

  # 題は返ってきたが、どれも語をかすっていない場合も同じ
  it "題がかすってもいなければ、本文まで見に行く" do
    stub_paths(title_pages: [ page("まったく別の記事") ], page_pages: [ page("ネットワーク") ])

    result = described_class.call("ネットワークの通り道")

    expect(result.candidates.map(&:title)).to eq([ "まったく別の記事", "ネットワーク" ])
  end

  it "同じ記事は1度だけ出す" do
    stub_paths(title_pages: [ page("ネットワーク") ], page_pages: [ page("ネットワーク"), page("通信") ])

    result = described_class.call("ネットワークの通り道")

    expect(result.candidates.map(&:title)).to eq([ "ネットワーク", "通信" ])
  end

  it "出す数の上限は守る" do
    stub_paths(title_pages: [], page_pages: (1..10).map { |n| page("記事#{n}") })

    expect(described_class.call("なにか").candidates.size).to eq(described_class::LIMIT)
  end

  # 本文の検索が落ちても、題で拾えたものは捨てない
  it "本文の検索が落ちても、題の結果は返す" do
    stub_paths(title_pages: [ page("別の記事") ], page_raises: Faraday::ConnectionFailed.new("boom"))

    result = described_class.call("ネットワークの通り道")

    expect(result.candidates.map(&:title)).to eq([ "別の記事" ])
  end

  # 当てずっぽうを「近い記事」と言わない。判定はそのまま残す
  it "本文で拾ったものでも、かすっていなければ弱いままにする" do
    stub_paths(title_pages: [], page_pages: [ page("ぱーてぃーちゃん") ])

    result = described_class.call("でぃーえぬえす")

    expect(result.candidates.map(&:title)).to eq([ "ぱーてぃーちゃん" ])
    expect(result.weak?("でぃーえぬえす")).to be(true)
  end
end
