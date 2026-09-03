require "rails_helper"

RSpec.describe GenerateFactCheckService do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, user: user, title: "光合成") }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_return("test-key")
  end

  def stub_chat(content)
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat).and_return(
      { "choices" => [ { "message" => { "content" => content } } ] }
    )
  end

  # AI へ実際に渡した本文を覗く（何を見せたかが、この機能の要）
  def capture_user_message(content)
    sent = []
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat) do |args|
      sent << args.dig(:parameters, :messages).find { |m| m[:role] == "user" }[:content]
      { "choices" => [ { "message" => { "content" => content } } ] }
    end
    sent
  end

  it "説明があれば判定とコメントを meaning に保存する" do
    meaning = item.meanings.create!(definition: "植物が光で養分を作る働き", language_code: "ja")
    stub_chat({ status: "correct", comment: "おおむね正しい。光以外に水とCO2も必要。" }.to_json)

    result = described_class.call(item: item)

    expect(result).to eq(meaning)
    expect(meaning.reload.fact_check_status).to eq("correct")
    expect(meaning.fact_check_comment).to include("水とCO2")
    expect(meaning.fact_checked_at).to be_present
  end

  it "doubtful のとき訂正案(suggestion)も保存する" do
    meaning = item.meanings.create!(definition: "間違った説明", language_code: "ja")
    stub_chat({ status: "doubtful", comment: "不正確です", suggestion: "正しい説明はこちら" }.to_json)

    described_class.call(item: item)

    expect(meaning.reload.fact_check_status).to eq("doubtful")
    expect(meaning.fact_check_suggestion).to eq("正しい説明はこちら")
  end

  it "単語名の訂正案(title_suggestion)も保存する" do
    meaning = item.meanings.create!(definition: "水素の同位体…", language_code: "ja")
    stub_chat({ status: "incorrect", comment: "別語です", suggestion: "正しい説明",
                title_suggestion: "トリチウム" }.to_json)

    described_class.call(item: item)

    expect(meaning.reload.fact_check_title_suggestion).to eq("トリチウム")
  end

  it "現在の単語名と同じ title_suggestion は無視する" do
    meaning = item.meanings.create!(definition: "説明", language_code: "ja")
    stub_chat({ status: "doubtful", comment: "x", suggestion: "y", title_suggestion: "光合成" }.to_json)

    described_class.call(item: item)

    expect(meaning.reload.fact_check_title_suggestion).to be_nil
  end

  it "correct のときは suggestion を保存しない" do
    meaning = item.meanings.create!(definition: "正しい説明", language_code: "ja")
    stub_chat({ status: "correct", comment: "OK", suggestion: "余計な訂正" }.to_json)

    described_class.call(item: item)

    expect(meaning.reload.fact_check_suggestion).to be_nil
  end

  it "説明が無ければ nil を返す（スキップ扱い）" do
    expect(described_class.call(item: item)).to be_nil
  end

  it "不正な status なら GenerationError を投げる" do
    item.meanings.create!(definition: "x", language_code: "ja")
    stub_chat({ status: "maybe", comment: "?" }.to_json)

    expect { described_class.call(item: item) }.to raise_error(GenerateFactCheckService::GenerationError)
  end

  it "不正な JSON なら GenerationError を投げる" do
    item.meanings.create!(definition: "x", language_code: "ja")
    stub_chat("not json")

    expect { described_class.call(item: item) }.to raise_error(GenerateFactCheckService::GenerationError)
  end

  describe "根拠（known / claims）" do
    it "独立に確認できることと、主張ごとの検証結果を保存する" do
      meaning = item.meanings.create!(definition: "植物が光で養分を作る働き", language_code: "ja")
      stub_chat({
        known: "光合成は実在する。植物が光エネルギーで有機物を作る反応。",
        claims: [ { text: "植物が行う", verdict: "supported", note: "" } ],
        status: "correct", comment: "OK"
      }.to_json)

      described_class.call(item: item)

      meaning.reload
      expect(meaning.fact_check_known).to include("実在する")
      # field は「どこから出た主張か」。説明だけを見たときは全て「説明」になる
      expect(meaning.fact_check_claims).to eq(
        [ { "field" => "説明", "kind" => "fact", "text" => "植物が行う", "verdict" => "supported", "note" => "" } ]
      )
    end

    it "矛盾する主張があるのに correct と言ってきたら incorrect に正す" do
      meaning = item.meanings.create!(definition: "動物が行う", language_code: "ja")
      stub_chat({
        known: "光合成は植物が行う。",
        claims: [ { text: "動物が行う", verdict: "contradicted", note: "植物の反応" } ],
        status: "correct", comment: "OK"
      }.to_json)

      described_class.call(item: item)

      expect(meaning.reload.fact_check_status).to eq("incorrect")
    end

    it "裏づけられない主張があるのに correct と言ってきたら doubtful に正す" do
      meaning = item.meanings.create!(definition: "毎秒1兆回起きる", language_code: "ja")
      stub_chat({
        known: "光合成は植物が行う。回数は確認できない。",
        claims: [ { text: "毎秒1兆回起きる", verdict: "unsupported", note: "確認できない" } ],
        status: "correct", comment: "OK"
      }.to_json)

      described_class.call(item: item)

      expect(meaning.reload.fact_check_status).to eq("doubtful")
    end

    it "全て supported なら correct のまま（過剰に厳しくしない）" do
      meaning = item.meanings.create!(definition: "植物が光で養分を作る働き", language_code: "ja")
      stub_chat({
        known: "光合成は植物が行う。",
        claims: [ { text: "植物が行う", verdict: "supported", note: "" } ],
        status: "correct", comment: "OK"
      }.to_json)

      described_class.call(item: item)

      expect(meaning.reload.fact_check_status).to eq("correct")
    end

    it "モデルが自分で doubtful と言っているものを甘くしない" do
      meaning = item.meanings.create!(definition: "説明", language_code: "ja")
      stub_chat({
        known: "確認できない語。",
        claims: [ { text: "主張", verdict: "supported", note: "" } ],
        status: "doubtful", comment: "実在が確認できない"
      }.to_json)

      described_class.call(item: item)

      expect(meaning.reload.fact_check_status).to eq("doubtful")
    end

    it "不正な verdict は unsupported に丸め、主張が多すぎるときは上限で切る" do
      meaning = item.meanings.create!(definition: "説明", language_code: "ja")
      claims = Array.new(10) { |i| { text: "主張#{i}", verdict: "たぶん", note: "" } }
      stub_chat({ known: "k", claims: claims, status: "correct", comment: "OK" }.to_json)

      described_class.call(item: item)

      meaning.reload
      expect(meaning.fact_check_claims.size).to eq(GenerateFactCheckService::MAX_CLAIMS)
      expect(meaning.fact_check_claims.map { |c| c["verdict"] }.uniq).to eq([ "unsupported" ])
      # unsupported が混じるので correct にはしない
      expect(meaning.fact_check_status).to eq("doubtful")
    end

    it "claims が空でも従来どおり判定できる（旧フォーマットの応答を壊さない）" do
      meaning = item.meanings.create!(definition: "説明", language_code: "ja")
      stub_chat({ status: "correct", comment: "OK" }.to_json)

      described_class.call(item: item)

      meaning.reload
      expect(meaning.fact_check_status).to eq("correct")
      expect(meaning.fact_check_claims).to eq([])
      expect(meaning.fact_check_known).to be_nil
    end
  end

  describe "説明・単語名を変えたときの無効化" do
    it "根拠も一緒に消える" do
      meaning = item.meanings.create!(
        definition: "説明", language_code: "ja",
        fact_check_status: "correct", fact_check_known: "既知", fact_check_claims: [ { "text" => "x" } ],
        fact_checked_at: Time.current
      )

      meaning.clear_fact_check

      expect(meaning.fact_check_status).to be_nil
      expect(meaning.fact_check_known).to be_nil
      expect(meaning.fact_check_claims).to eq([])
      expect(meaning.fact_checked_at).to be_nil
    end
  end
  # 説明文だけを見ると、項目に書いた誤りが素通りする。
  # 「カード全体」では、書いてある項目もまとめて確かめる。
  describe "scope: all（カード全体）" do
    let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
    let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }

    def define_property(key:, label:, value_type: "text")
      user.property_definitions.create!(item_type: item_type, key: key, label: label, value_type: value_type)
    end

    def set_property(definition, input)
      row = item.item_properties.new(property_definition: definition)
      row.typed_value = input
      row.save!
      row
    end

    before { item.meanings.create!(definition: "植物が光で養分を作る働き", language_code: "ja") }

    it "書いてある項目を見出し付きで AI へ渡す" do
      set_property(define_property(key: "field", label: "分野"), "生物")
      set_property(define_property(key: "readings", label: "読み方", value_type: "reading"),
                   [ { "language" => "ja", "text" => "こうごうせい" } ])
      sent = capture_user_message({ status: "correct", comment: "" }.to_json)

      described_class.call(item: item, scope: "all")

      expect(sent.first).to include("分野: 生物")
      expect(sent.first).to include("読み方: ja: こうごうせい")
    end

    it "説明だけのときは項目を渡さない（余計な費用と時間をかけない）" do
      set_property(define_property(key: "field", label: "分野"), "生物")
      sent = capture_user_message({ status: "correct", comment: "" }.to_json)

      described_class.call(item: item)

      expect(sent.first).not_to include("分野")
    end

    it "空の項目は渡さない（「未設定」を事実主張として拾わせない）" do
      define_property(key: "field", label: "分野")
      sent = capture_user_message({ status: "correct", comment: "" }.to_json)

      described_class.call(item: item, scope: "all")

      expect(sent.first).not_to include("分野")
    end

    it "どの項目から出た指摘かを残す" do
      set_property(define_property(key: "field", label: "分野"), "物理")
      stub_chat({
        status: "incorrect", comment: "分野が違います",
        claims: [ { field: "分野", text: "光合成は物理の語である", verdict: "contradicted", note: "生物です" } ]
      }.to_json)

      described_class.call(item: item, scope: "all")

      claim = item.primary_meaning.reload.fact_check_claims.first
      expect(claim["field"]).to eq("分野")
      expect(claim["verdict"]).to eq("contradicted")
    end

    it "見出しが無い指摘は「説明」から出たものとして扱う" do
      stub_chat({
        status: "doubtful", comment: "",
        claims: [ { text: "光で養分を作る", verdict: "unsupported" } ]
      }.to_json)

      described_class.call(item: item, scope: "all")

      expect(item.primary_meaning.reload.fact_check_claims.first["field"]).to eq("説明")
    end

    it "知らない scope は説明だけに落とす" do
      set_property(define_property(key: "field", label: "分野"), "生物")
      sent = capture_user_message({ status: "correct", comment: "" }.to_json)

      described_class.call(item: item, scope: "everything")

      expect(sent.first).not_to include("分野")
    end
    it "何を見たうえでの判定かを残す（指摘の出なかった項目は claims に現れない）" do
      set_property(define_property(key: "field", label: "分野"), "生物")
      set_property(define_property(key: "era", label: "年代"), "19世紀")
      stub_chat({ status: "correct", comment: "", claims: [] }.to_json)

      described_class.call(item: item, scope: "all")

      expect(item.primary_meaning.reload.fact_check_fields).to eq([ "説明", "分野", "年代" ])
    end

    it "説明だけを見たときは、見た範囲も説明だけになる" do
      set_property(define_property(key: "field", label: "分野"), "生物")
      stub_chat({ status: "correct", comment: "" }.to_json)

      described_class.call(item: item)

      expect(item.primary_meaning.reload.fact_check_fields).to eq([ "説明" ])
    end

    it "要素どうしの食い違いを、種類つきで残す" do
      set_property(define_property(key: "field", label: "分野"), "物理")
      stub_chat({
        status: "incorrect", comment: "分野が合いません",
        claims: [ { field: "要素間", kind: "consistency", text: "説明は生物の話だが分野が物理",
                    verdict: "contradicted", note: "分野が誤り" } ]
      }.to_json)

      described_class.call(item: item, scope: "all")

      claim = item.primary_meaning.reload.fact_check_claims.first
      expect(claim["kind"]).to eq("consistency")
      expect(claim["field"]).to eq("要素間")
    end

    it "知らない種類は fact に落とす（画面の出し分けを壊さない）" do
      stub_chat({
        status: "doubtful", comment: "",
        claims: [ { field: "説明", kind: "vibes", text: "なんとなく怪しい", verdict: "unsupported" } ]
      }.to_json)

      described_class.call(item: item, scope: "all")

      expect(item.primary_meaning.reload.fact_check_claims.first["kind"]).to eq("fact")
    end
  end
end
