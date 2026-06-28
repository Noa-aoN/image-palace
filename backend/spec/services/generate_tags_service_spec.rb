require "rails_helper"

RSpec.describe GenerateTagsService do
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

  it "生成したタグをアイテムに付与する" do
    stub_chat({ tags: %w[生物学 理科 植物] }.to_json)

    result = described_class.call(item: item)

    expect(result.tags.map(&:name)).to match_array(%w[生物学 理科 植物])
    expect(item.reload.tags.count).to eq(3)
  end

  it "既存タグを消さず union で追加する" do
    existing = user.tags.create!(name: "お気に入り")
    item.tags << existing
    stub_chat({ tags: %w[生物学] }.to_json)

    described_class.call(item: item)

    expect(item.reload.tags.map(&:name)).to match_array(%w[お気に入り 生物学])
  end

  it "replace=true なら既存タグを置き換える" do
    existing = user.tags.create!(name: "お気に入り")
    item.tags << existing
    stub_chat({ tags: %w[生物学 植物] }.to_json)

    described_class.call(item: item, replace: true)

    expect(item.reload.tags.map(&:name)).to match_array(%w[生物学 植物])
  end

  it "既存タグを大文字小文字を無視して再利用する（重複作成しない）" do
    user.tags.create!(name: "Biology")
    stub_chat({ tags: %w[biology] }.to_json)

    expect { described_class.call(item: item) }.not_to change { user.tags.count }
    expect(item.reload.tags.map(&:name)).to eq(%w[Biology])
  end

  it "最大5件に制限する" do
    stub_chat({ tags: %w[a b c d e f g] }.to_json)

    described_class.call(item: item)

    expect(item.reload.tags.count).to eq(5)
  end

  it "長すぎるタグ名は除外する" do
    long = "あ" * (Tag::NAME_MAX_LENGTH + 1)
    stub_chat({ tags: [ long, "理科" ] }.to_json)

    described_class.call(item: item)

    expect(item.reload.tags.map(&:name)).to eq(%w[理科])
  end

  it "tags が配列でなければ GenerationError を投げる" do
    stub_chat({ foo: "bar" }.to_json)

    expect { described_class.call(item: item) }.to raise_error(GenerateTagsService::GenerationError)
  end

  it "不正な JSON なら GenerationError を投げる" do
    stub_chat("これはJSONではない")

    expect { described_class.call(item: item) }.to raise_error(GenerateTagsService::GenerationError)
  end
end
