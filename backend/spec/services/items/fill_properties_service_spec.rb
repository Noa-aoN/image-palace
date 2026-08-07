require "rails_helper"

RSpec.describe Items::FillPropertiesService do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, :completed, user: user, item_type: item_type, title: "光合成") }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_return("test-key")
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY", anything).and_return("test-key")
    allow(Moderation::PromptModerator).to receive(:call).and_return(
      Moderation::PromptModerator::Result.new(allowed: true)
    )
  end

  def define!(key:, value_type: "text", label: "項目")
    user.property_definitions.create!(item_type: item_type, key: key, label: label, value_type: value_type)
  end

  def stub_chat(values)
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat).and_return(
      { "choices" => [ { "message" => { "content" => { values: values }.to_json } } ] }
    )
    client
  end

  it "定義された項目をまとめて埋める" do
    define!(key: "reading", label: "読み仮名")
    define!(key: "aliases", label: "別名", value_type: "list")
    stub_chat({ reading: "こうごうせい", aliases: [ "炭酸同化" ] })

    result = described_class.call(item: item, user: user)

    expect(result.filled_keys).to contain_exactly("reading", "aliases")
    expect(item.item_properties.count).to eq(2)
  end

  it "項目がいくつあっても問い合わせは1回だけ（項目数に費用を比例させない）" do
    5.times { |i| define!(key: "k#{i}") }
    client = stub_chat({ k0: "a", k1: "b", k2: "c", k3: "d", k4: "e" })

    described_class.call(item: item, user: user)

    expect(client).to have_received(:chat).once
  end

  it "既に手で書いた項目は上書きせず、AI にも渡さない（既定）" do
    definition = define!(key: "reading")
    define!(key: "pronunciation")
    item.item_properties.create!(property_definition: definition, value: { "v" => "てで かいた" })
    client = stub_chat({ pronunciation: "IPA" })

    described_class.call(item: item, user: user)

    expect(definition.item_properties.first.reload.typed_value).to eq("てで かいた")
    expect(client).to have_received(:chat) do |parameters:|
      content = parameters[:messages].last[:content]
      expect(content).to include("pronunciation")
      expect(content).not_to include("reading")
    end
  end

  it "埋める対象が1つも無ければ問い合わせない" do
    definition = define!(key: "reading")
    item.item_properties.create!(property_definition: definition, value: { "v" => "てで かいた" })
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(item: item, user: user) }
      .to raise_error(described_class::FillError, /埋める項目がありません/)
  end

  it "overwrite を指定したときだけ書き換える" do
    definition = define!(key: "reading")
    item.item_properties.create!(property_definition: definition, value: { "v" => "ふるい" })
    stub_chat({ reading: "あたらしい" })

    described_class.call(item: item, user: user, overwrite: true)

    expect(item.item_properties.first.reload.typed_value).to eq("あたらしい")
  end

  it "返ってこなかった項目は skipped に載せる（黙って空で埋めない）" do
    define!(key: "reading")
    define!(key: "pronunciation")
    stub_chat({ reading: "こうごうせい" })

    result = described_class.call(item: item, user: user)

    expect(result.filled_keys).to eq([ "reading" ])
    expect(result.skipped_keys).to eq([ "pronunciation" ])
  end

  it "型に合わない値は落とす（読めない値でカードを壊さない）" do
    define!(key: "year", value_type: "number")
    define!(key: "source", value_type: "url")
    stub_chat({ year: "むかし", source: "javascript:alert(1)" })

    result = described_class.call(item: item, user: user)

    expect(result.filled_keys).to be_empty
    expect(item.item_properties.count).to eq(0)
  end

  it "定義が無ければ問い合わせない" do
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(item: item, user: user) }
      .to raise_error(described_class::FillError, /埋める項目がありません/)
  end

  it "モデレーションに引っかかる入力では問い合わせない" do
    define!(key: "reading")
    allow(Moderation::PromptModerator).to receive(:call).and_return(
      Moderation::PromptModerator::Result.new(allowed: false, category: "violence", term: "x")
    )
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(item: item, user: user) }
      .to raise_error(described_class::FillError, /利用できない表現/)
  end

  it "不正な JSON なら FillError" do
    define!(key: "reading")
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat).and_return(
      { "choices" => [ { "message" => { "content" => "これはJSONではない" } } ] }
    )

    expect { described_class.call(item: item, user: user) }.to raise_error(described_class::FillError)
  end
end
