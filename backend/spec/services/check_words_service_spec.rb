require "rails_helper"

RSpec.describe CheckWordsService do
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

  it "テーマから外れた単語を指摘し、追加提案を返す" do
    stub_chat({
      issues: [
        { word: "りんご", verdict: "ok", reason: "", replacement: "" },
        { word: "スパナ", verdict: "off_theme", reason: "工具であり果物ではありません", replacement: "ぶどう" }
      ],
      additions: [ "もも", "みかん" ]
    }.to_json)

    result = described_class.call(theme: "果物", words: %w[りんご スパナ])

    # ok は指摘ではないので返さない
    expect(result.issues.size).to eq(1)
    issue = result.issues.first
    expect(issue[:word]).to eq("スパナ")
    expect(issue[:verdict]).to eq("off_theme")
    expect(issue[:reason]).to eq("工具であり果物ではありません")
    expect(issue[:replacement]).to eq("ぶどう")
    expect(result.additions).to eq(%w[もも みかん])
  end

  it "未知の判定・送っていない単語の指摘は捨てる" do
    stub_chat({
      issues: [
        { word: "りんご", verdict: "unknown_verdict", reason: "?", replacement: "" },
        { word: "存在しない語", verdict: "off_theme", reason: "?", replacement: "" }
      ],
      additions: []
    }.to_json)

    result = described_class.call(theme: "果物", words: %w[りんご])

    expect(result.issues).to be_empty
  end

  it "元の語と同じ置換案は落とす" do
    stub_chat({
      issues: [ { word: "りんご", verdict: "typo", reason: "誤記", replacement: "りんご" } ],
      additions: []
    }.to_json)

    result = described_class.call(theme: "果物", words: %w[りんご])

    expect(result.issues.first[:replacement]).to be_nil
  end

  it "既にリストにある語は追加提案しない" do
    stub_chat({ issues: [], additions: [ "りんご", "もも", "" ] }.to_json)

    result = described_class.call(theme: "果物", words: %w[りんご])

    expect(result.additions).to eq(%w[もも])
  end

  it "単語が空なら GenerationError" do
    expect { described_class.call(theme: "果物", words: []) }
      .to raise_error(described_class::GenerationError)
  end

  it "JSON が壊れていたら GenerationError" do
    stub_chat("not json")

    expect { described_class.call(theme: "果物", words: %w[りんご]) }
      .to raise_error(described_class::GenerationError)
  end
end
