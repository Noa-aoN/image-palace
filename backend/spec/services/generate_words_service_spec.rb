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

  it "exclude の語は結果から確実に除外する" do
    stub_chat({ words: %w[apple banana cherry] }.to_json)
    words = described_class.call(theme: "果物", count: 5, exclude: %w[banana])
    expect(words).to eq(%w[apple cherry])
  end

  it "words が空なら GenerationError を投げる" do
    stub_chat({ words: [] }.to_json)
    expect { described_class.call(theme: "x", count: 3) }.to raise_error(GenerateWordsService::GenerationError)
  end

  it "不正な JSON なら GenerationError を投げる" do
    stub_chat("これはJSONではない")
    expect { described_class.call(theme: "x", count: 3) }.to raise_error(GenerateWordsService::GenerationError)
  end

  describe "語彙の難しさ" do
    def captured_system_prompt
      captured = nil
      allow(Ai::Chat).to receive(:call) do |messages:, **|
        captured = messages.first[:content]
        { "choices" => [ { "message" => { "content" => { words: [ "あ" ] }.to_json } } ] }
      end
      yield
      captured
    end

    it "指定した難しさの指示を足す" do
      prompt = captured_system_prompt { described_class.call(theme: "科学", difficulty: "expert") }

      expect(prompt).to include("その分野を学んだ人でなければ知らない水準")
    end

    it "やさしい指定では身近なものに寄せる" do
      prompt = captured_system_prompt { described_class.call(theme: "科学", difficulty: "easy") }

      expect(prompt).to include("小学生でも知っている")
    end

    it "指定が無ければ既定（ふつう）になる" do
      prompt = captured_system_prompt { described_class.call(theme: "科学") }

      expect(prompt).to include("中学〜高校で出会う程度")
    end

    it "知らない指定は既定に丸める" do
      prompt = captured_system_prompt { described_class.call(theme: "科学", difficulty: "とても難しい") }

      expect(prompt).to include("中学〜高校で出会う程度")
    end

    it "元の指示は残したまま、難しさだけを重ねる（打ち消し合わない）" do
      prompt = captured_system_prompt { described_class.call(theme: "科学", difficulty: "hard") }

      expect(prompt).to include("学習用の単語リスト作成アシスタント")
      expect(prompt).to include("画像化しやすい具体的な名詞を優先")
      expect(prompt).to include("大学の教養課程")
    end

    it "受け付ける難しさは4段階" do
      expect(described_class::DIFFICULTIES).to eq(%w[easy normal hard expert])
      described_class::DIFFICULTIES.each do |level|
        expect(described_class::DIFFICULTY_GUIDES).to have_key(level)
      end
    end
  end
end
