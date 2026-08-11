require "rails_helper"

RSpec.describe Cards::SuggestPropertiesService do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, user: user, title: "アレクサンドロス3世") }
  let(:available) { %w[reading aliases formula wikipedia] }

  def stub_chat(content)
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat).and_return(
      { "choices" => [ { "message" => { "content" => content } } ] }
    )
    client
  end

  it "選んだ項目を並び順のまま返す" do
    stub_chat({ keys: %w[wikipedia reading] }.to_json)

    result = described_class.call(item: item, available_keys: available, user: user)

    expect(result.keys).to eq(%w[wikipedia reading])
  end

  # AI が考えた識別名で当てると、存在しない項目を指した並びが保存される
  it "渡していない識別名は落とす" do
    stub_chat({ keys: %w[wikipedia nonexistent] }.to_json)

    expect(described_class.call(item: item, available_keys: available, user: user).keys).to eq(%w[wikipedia])
  end

  it "1つも残らなければ断る" do
    stub_chat({ keys: %w[nonexistent] }.to_json)

    expect { described_class.call(item: item, available_keys: available, user: user) }
      .to raise_error(described_class::SuggestError, /選べませんでした/)
  end

  it "選べる項目が無ければ問い合わせない" do
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(item: item, available_keys: [], user: user) }
      .to raise_error(described_class::SuggestError, /選べる項目がありません/)
  end

  it "読めない返事は断る" do
    stub_chat("これは JSON ではない")

    expect { described_class.call(item: item, available_keys: available, user: user) }
      .to raise_error(described_class::SuggestError, /解析に失敗/)
  end

  # 作成・再生成と同じ基準。ここだけ素通りさせない
  it "モデレーションに引っかかる入力では問い合わせない" do
    allow(Moderation::PromptModerator).to receive(:call).and_return(
      Moderation::PromptModerator::Result.new(allowed: false, category: "violence", term: "禁止")
    )
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(item: item, available_keys: available, user: user) }
      .to raise_error(described_class::SuggestError, /利用できない表現/)
  end

  it "選べる項目の一覧を渡す（新しい項目を考えさせない）" do
    client = stub_chat({ keys: %w[wikipedia] }.to_json)

    described_class.call(item: item, available_keys: available, user: user)

    expect(client).to have_received(:chat) do |parameters:|
      expect(parameters[:messages].last[:content]).to include("reading, aliases, formula, wikipedia")
    end
  end
end
