require "rails_helper"

RSpec.describe Images::SceneRewriteService do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, :completed, user: user, title: "機会費用") }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_return("test-key")
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY", anything).and_return("test-key")
    allow(Moderation::PromptModerator).to receive(:call).and_return(
      Moderation::PromptModerator::Result.new(allowed: true)
    )
  end

  def add_meaning(definition)
    item.meanings.create!(language_code: "ja", definition: definition)
    item.reload
  end

  def stub_chat(content)
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat).and_return(
      { "choices" => [ { "message" => { "content" => content } } ] }
    )
    client
  end

  it "意味・説明をもとに書き直した情景を返す" do
    add_meaning("ある選択をしたときに諦めた、他の選択肢から得られたはずの価値のこと。")
    stub_chat({ options: [ { label: "経済学の用語", scene_prompt: "A person at a fork in a country road at dusk" } ] }.to_json)

    result = described_class.call(item: item, user: user)

    expect(result.options.size).to eq(1)
    expect(result.options.first.label).to eq("経済学の用語")
    expect(result.options.first.scene_prompt).to include("fork in a country road")
  end

  it "意味・ジャンルが分かれる語では候補を複数返す（選ぶのは利用者）" do
    add_meaning("アポロはギリシャ神話の神であり、NASA の宇宙計画の名でもある。")
    stub_chat({
      options: [
        { label: "ギリシャ神話の神", scene_prompt: "A marble statue of a youthful god with a lyre" },
        { label: "NASA の宇宙計画", scene_prompt: "A lunar module on the grey surface of the moon" }
      ]
    }.to_json)

    result = described_class.call(item: item, user: user)

    expect(result.options.map(&:label)).to eq([ "ギリシャ神話の神", "NASA の宇宙計画" ])
  end

  it "候補は上限までしか返さない（選ぶのが仕事にならないように）" do
    add_meaning("諦めた選択肢の価値")
    stub_chat({ options: Array.new(6) { |i| { label: "案#{i}", scene_prompt: "scene #{i}" } } }.to_json)

    expect(described_class.call(item: item, user: user).options.size)
      .to eq(described_class::MAX_OPTIONS)
  end

  it "情景が空の候補は捨てる" do
    add_meaning("諦めた選択肢の価値")
    stub_chat({ options: [ { label: "空っぽ", scene_prompt: "" }, { label: "本命", scene_prompt: "a real scene" } ] }.to_json)

    result = described_class.call(item: item, user: user)

    expect(result.options.map(&:label)).to eq([ "本命" ])
  end

  it "意味・説明が無いカードは問い合わせずに RewriteError を投げる" do
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(item: item, user: user) }
      .to raise_error(described_class::RewriteError, /意味・説明がありません/)
  end

  it "意味・説明と、いまの情景・補足指示を材料として渡す" do
    add_meaning("諦めた選択肢の価値")
    item.update!(scene_prompt: "an old draft scene", custom_prompt: "もっと写実的に")
    client = stub_chat({ options: [ { label: "案", scene_prompt: "a rewritten scene" } ] }.to_json)

    described_class.call(item: item, user: user)

    expect(client).to have_received(:chat) do |parameters:|
      content = parameters[:messages].last[:content]
      expect(content).to include("諦めた選択肢の価値")
      expect(content).to include("an old draft scene")
      expect(content).to include("もっと写実的に")
      expect(parameters[:response_format]).to eq({ type: "json_object" })
    end
  end

  it "結果は保存しない（利用者が確かめてから作り直すため）" do
    add_meaning("諦めた選択肢の価値")
    item.update!(scene_prompt: "an old draft scene")
    stub_chat({ options: [ { label: "案", scene_prompt: "a rewritten scene" } ] }.to_json)

    described_class.call(item: item, user: user)

    expect(item.reload.scene_prompt).to eq("an old draft scene")
  end

  it "モデレーションに引っかかる説明文では問い合わせずに RewriteError を投げる" do
    add_meaning("禁止された表現")
    allow(Moderation::PromptModerator).to receive(:call).and_return(
      Moderation::PromptModerator::Result.new(allowed: false, category: "violence", term: "禁止")
    )
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(item: item, user: user) }
      .to raise_error(described_class::RewriteError, /利用できない表現/)
  end

  it "使える候補がひとつも無ければ RewriteError を投げる" do
    add_meaning("諦めた選択肢の価値")
    stub_chat({ options: [ { label: "空っぽ", scene_prompt: "" } ] }.to_json)

    expect { described_class.call(item: item, user: user) }.to raise_error(described_class::RewriteError)
  end

  it "不正な JSON なら RewriteError を投げる" do
    add_meaning("諦めた選択肢の価値")
    stub_chat("これはJSONではない")

    expect { described_class.call(item: item, user: user) }.to raise_error(described_class::RewriteError)
  end

  it "長すぎる出力は上限で切り詰める（画像生成側が主題を見失わないように）" do
    add_meaning("諦めた選択肢の価値")
    stub_chat({ options: [ { label: "あ" * 100, scene_prompt: "a" * 3000 } ] }.to_json)

    result = described_class.call(item: item, user: user)

    expect(result.options.first.scene_prompt.length).to eq(described_class::MAX_SCENE_PROMPT_LENGTH)
    expect(result.options.first.label.length).to eq(described_class::MAX_LABEL_LENGTH)
  end
end
