require "rails_helper"

RSpec.describe Cards::DetectItemTypeService do
  let(:user) { create(:user, :confirmed) }

  # 種別は seeds で入る共有レコード。無い環境でも走るように用意する
  let!(:types) do
    %w[term concept entity person event].map do |name|
      ItemType.find_or_create_by!(name: name) { |t| t.label = name }
    end
  end

  def stub_chat(content)
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat).and_return(
      { "choices" => [ { "message" => { "content" => content } } ] }
    )
    client
  end

  it "選ばれた種別を返す" do
    stub_chat({ name: "person" }.to_json)

    result = described_class.call(title: "アレクサンドロス3世", user: user)

    expect(result.item_type.name).to eq("person")
  end

  # AI が考えた名前で当てると、存在しない種別を指したカードができる
  it "一覧に無い名前は採らない" do
    stub_chat({ name: "creature" }.to_json)

    expect { described_class.call(title: "トリケラトプス", user: user) }
      .to raise_error(described_class::DetectError)
  end

  it "読めない返事は断る" do
    stub_chat("種別は person です")

    expect { described_class.call(title: "アレクサンドロス3世", user: user) }
      .to raise_error(described_class::DetectError)
  end

  it "見出し語が空なら呼ばない" do
    expect(OpenAI::Client).not_to receive(:new)

    expect { described_class.call(title: "  ", user: user) }
      .to raise_error(described_class::DetectError)
  end

  # OpenAI へ渡る入力は必ず検査する（作成・再生成と同じ基準）
  it "検査に通らない入力は判定しない" do
    allow(Moderation::PromptModerator).to receive(:call)
      .and_return(instance_double(Moderation::PromptModerator::Result, allowed?: false, category: "test"))

    expect(OpenAI::Client).not_to receive(:new)
    expect { described_class.call(title: "だめな語", user: user) }
      .to raise_error(described_class::DetectError)
  end

  it "選べる種別を、識別名と呼び名の両方で渡す" do
    client = stub_chat({ name: "term" }.to_json)
    described_class.call(title: "貿易風", user: user)

    expect(client).to have_received(:chat) do |args|
      content = args[:parameters][:messages].last[:content]
      expect(content).to include("person")
      expect(content).to include("貿易風")
    end
  end
end
