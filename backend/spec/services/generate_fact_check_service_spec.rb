require "rails_helper"

RSpec.describe GenerateFactCheckService do
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

  it "説明があれば判定とコメントを meaning に保存する" do
    meaning = item.meanings.create!(definition: "植物が光で養分を作る働き", language_code: "ja")
    stub_chat({ status: "correct", comment: "おおむね正しい。光以外に水とCO2も必要。" }.to_json)

    result = described_class.call(item: item)

    expect(result).to eq(meaning)
    expect(meaning.reload.fact_check_status).to eq("correct")
    expect(meaning.fact_check_comment).to include("水とCO2")
    expect(meaning.fact_checked_at).to be_present
  end

  it "doubtful のとき訂正案(suggestion)も保存する" do
    meaning = item.meanings.create!(definition: "間違った説明", language_code: "ja")
    stub_chat({ status: "doubtful", comment: "不正確です", suggestion: "正しい説明はこちら" }.to_json)

    described_class.call(item: item)

    expect(meaning.reload.fact_check_status).to eq("doubtful")
    expect(meaning.fact_check_suggestion).to eq("正しい説明はこちら")
  end

  it "correct のときは suggestion を保存しない" do
    meaning = item.meanings.create!(definition: "正しい説明", language_code: "ja")
    stub_chat({ status: "correct", comment: "OK", suggestion: "余計な訂正" }.to_json)

    described_class.call(item: item)

    expect(meaning.reload.fact_check_suggestion).to be_nil
  end

  it "説明が無ければ nil を返す（スキップ扱い）" do
    expect(described_class.call(item: item)).to be_nil
  end

  it "不正な status なら GenerationError を投げる" do
    item.meanings.create!(definition: "x", language_code: "ja")
    stub_chat({ status: "maybe", comment: "?" }.to_json)

    expect { described_class.call(item: item) }.to raise_error(GenerateFactCheckService::GenerationError)
  end

  it "不正な JSON なら GenerationError を投げる" do
    item.meanings.create!(definition: "x", language_code: "ja")
    stub_chat("not json")

    expect { described_class.call(item: item) }.to raise_error(GenerateFactCheckService::GenerationError)
  end
end
