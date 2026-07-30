require "rails_helper"

RSpec.describe Moderation::OpenaiModerator, type: :service do
  let(:client) { instance_double(OpenAI::Client) }

  # テスト環境では既定オフのため、明示的に有効化する
  around do |example|
    ENV["OPENAI_MODERATION_ENABLED"] = "true"
    ENV["OPENAI_API_KEY"] ||= "test-key"
    example.run
  ensure
    ENV.delete("OPENAI_MODERATION_ENABLED")
  end

  before do
    allow(OpenAI::Client).to receive(:new).and_return(client)
    # 「呼ばれていないこと」を検証するテストのために既定のスタブを置く（spy 化）
    allow(client).to receive(:moderations).and_return({ "results" => [ { "category_scores" => {} } ] })
  end

  def stub_scores(scores)
    allow(client).to receive(:moderations).and_return(
      { "results" => [ { "category_scores" => scores } ] }
    )
  end

  it "対象カテゴリが閾値を超えたらブロックする" do
    stub_scores({ "sexual/minors" => 0.99, "violence" => 0.1 })

    result = described_class.call("なにか")

    expect(result).not_to be_allowed
    expect(result.category).to eq("sexual/minors")
    expect(result.score).to be > 0.5
  end

  it "閾値以下なら通す（弱い反応で弾かない）" do
    stub_scores({ "sexual" => 0.4 })

    expect(described_class.call("なにか")).to be_allowed
  end

  # 学習アプリでは「戦争」「麻薬」等が violence / illicit で拾われる。過剰ブロックを避ける
  it "対象外カテゴリはスコアが高くても通す" do
    stub_scores({ "violence" => 0.95, "illicit" => 0.9, "hate" => 0.8 })

    expect(described_class.call("戦争")).to be_allowed
  end

  it "複数の対象カテゴリが超過したら最もスコアの高いものを返す" do
    stub_scores({ "sexual" => 0.6, "violence/graphic" => 0.92 })

    expect(described_class.call("なにか").category).to eq("violence/graphic")
  end

  it "API が失敗しても通す（fail-open）" do
    allow(client).to receive(:moderations).and_raise(Faraday::TimeoutError)
    allow(Rails.logger).to receive(:warn)

    expect(described_class.call("なにか")).to be_allowed
    expect(Rails.logger).to have_received(:warn).with(/Moderation/)
  end

  it "空文字は API を呼ばずに通す" do
    expect(described_class.call("  ")).to be_allowed
    expect(client).not_to have_received(:moderations)
  end

  context "無効化されているとき" do
    around do |example|
      ENV["OPENAI_MODERATION_ENABLED"] = "false"
      example.run
    ensure
      ENV.delete("OPENAI_MODERATION_ENABLED")
    end

    it "API を呼ばずに通す" do
      expect(described_class.call("なにか")).to be_allowed
      expect(client).not_to have_received(:moderations)
    end
  end
end
