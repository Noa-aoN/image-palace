require "rails_helper"

RSpec.describe GenerateMeaningService do
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

  it "意味を生成して日本語の Meaning を保存する" do
    stub_chat({ definition: "植物が光を使って養分を作る働き", example_sentence: "光合成には光が必要だ" }.to_json)

    meaning = described_class.call(item: item)

    expect(meaning.language_code).to eq("ja")
    expect(meaning.definition).to include("光")
    expect(item.reload.primary_meaning.example_sentence).to eq("光合成には光が必要だ")
  end

  it "既存の日本語の意味を上書きする（重複させない）" do
    item.meanings.create!(language_code: "ja", definition: "古い意味")
    stub_chat({ definition: "新しい意味", example_sentence: "" }.to_json)

    described_class.call(item: item)

    expect(item.reload.meanings.where(language_code: "ja").count).to eq(1)
    expect(item.primary_meaning.definition).to eq("新しい意味")
    expect(item.primary_meaning.example_sentence).to be_nil
  end

  it "definition が空なら GenerationError を投げる" do
    stub_chat({ definition: "", example_sentence: "x" }.to_json)

    expect { described_class.call(item: item) }.to raise_error(GenerateMeaningService::GenerationError)
  end

  it "不正な JSON なら GenerationError を投げる" do
    stub_chat("これはJSONではない")

    expect { described_class.call(item: item) }.to raise_error(GenerateMeaningService::GenerationError)
  end
end
