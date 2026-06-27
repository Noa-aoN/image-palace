require "rails_helper"

RSpec.describe GenerateWordsService do
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

  it "テーマから単語配列を生成する" do
    stub_chat({ words: %w[りんご バナナ さくらんぼ] }.to_json)
    words = described_class.call(theme: "果物", count: 3)
    expect(words).to eq(%w[りんご バナナ さくらんぼ])
  end

  it "重複・空白を除去し count で切り詰める" do
    stub_chat({ words: [ "a", "a", " ", "b", "c" ] }.to_json)
    words = described_class.call(theme: "x", count: 2)
    expect(words).to eq(%w[a b])
  end

  it "count 未指定（おまかせ）でもテーマに応じた数を返す" do
    stub_chat({ words: %w[子 丑 寅 卯] }.to_json)
    words = described_class.call(theme: "十二支")
    expect(words).to eq(%w[子 丑 寅 卯])
  end

  it "おまかせでも MAX_COUNT を超えない（ハードキャップ）" do
    stub_chat({ words: (1..80).map { |n| "w#{n}" } }.to_json)
    words = described_class.call(theme: "たくさん")
    expect(words.size).to eq(GenerateWordsService::MAX_COUNT)
  end

  it "words が空なら GenerationError を投げる" do
    stub_chat({ words: [] }.to_json)
    expect { described_class.call(theme: "x", count: 3) }.to raise_error(GenerateWordsService::GenerationError)
  end

  it "不正な JSON なら GenerationError を投げる" do
    stub_chat("これはJSONではない")
    expect { described_class.call(theme: "x", count: 3) }.to raise_error(GenerateWordsService::GenerationError)
  end
end
