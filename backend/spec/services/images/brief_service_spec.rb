require "rails_helper"

RSpec.describe Images::BriefService do
  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_return("test-key")
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY", anything).and_return("test-key")
  end

  def stub_chat(content)
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat).and_return(
      { "choices" => [ { "message" => { "content" => content } } ] }
    )
    client
  end

  it "説明文・種別・情景プロンプトを返す" do
    stub_chat({
      description: "機会費用とは、ある選択をしたときに諦めた他の選択肢の価値のこと。",
      subject_kind: "abstract",
      scene_prompt: "A person standing at a fork in a country road at dusk"
    }.to_json)

    result = described_class.call(title: "機会費用")

    expect(result.description).to include("機会費用")
    expect(result.subject_kind).to eq("abstract")
    expect(result.scene_prompt).to include("fork in a country road")
  end

  it "同じ単語なら誰が作っても同じになるよう temperature 0 で問い合わせる" do
    client = stub_chat({ description: "説明", subject_kind: "concrete", scene_prompt: "a red apple" }.to_json)

    described_class.call(title: "りんご")

    expect(client).to have_received(:chat) do |parameters:|
      expect(parameters[:temperature]).to eq(0)
      expect(parameters[:response_format]).to eq({ type: "json_object" })
    end
  end

  it "未知の subject_kind は concrete に丸める" do
    stub_chat({ description: "説明", subject_kind: "とてもあいまい", scene_prompt: "a red apple" }.to_json)

    expect(described_class.call(title: "りんご").subject_kind).to eq("concrete")
  end

  it "情景プロンプトが空なら GenerationError を投げる" do
    stub_chat({ description: "説明", subject_kind: "concrete", scene_prompt: "" }.to_json)

    expect { described_class.call(title: "りんご") }.to raise_error(described_class::GenerationError)
  end

  it "説明文が空なら GenerationError を投げる" do
    stub_chat({ description: "", subject_kind: "concrete", scene_prompt: "a red apple" }.to_json)

    expect { described_class.call(title: "りんご") }.to raise_error(described_class::GenerationError)
  end

  it "不正な JSON なら GenerationError を投げる" do
    stub_chat("これはJSONではない")

    expect { described_class.call(title: "りんご") }.to raise_error(described_class::GenerationError)
  end

  it "単語が空なら問い合わせずに GenerationError を投げる" do
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(title: "  ") }.to raise_error(described_class::GenerationError)
  end

  it "長すぎる出力は上限で切り詰める（画像生成側が主題を見失わないように）" do
    stub_chat({
      description: "あ" * 3000,
      subject_kind: "concrete",
      scene_prompt: "a" * 3000
    }.to_json)

    result = described_class.call(title: "りんご")

    expect(result.description.length).to eq(described_class::MAX_DESCRIPTION_LENGTH)
    expect(result.scene_prompt.length).to eq(described_class::MAX_SCENE_PROMPT_LENGTH)
  end
end
