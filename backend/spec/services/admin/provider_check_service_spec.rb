require "rails_helper"

RSpec.describe Admin::ProviderCheckService do
  let(:client) { instance_double(OpenAI::Client) }

  before do
    allow(OpenAI::Client).to receive(:new).and_return(client)
    ENV["OPENAI_API_KEY"] = "sk-test-key"
  end

  def quota_error
    Faraday::TooManyRequestsError.new(
      "429",
      { status: 429, body: { "error" => { "type" => "insufficient_quota", "code" => "credit_balance_exhausted" } } }
    )
  end

  it "応答があれば ok" do
    allow(client).to receive(:chat).and_return({ "choices" => [] })

    expect(described_class.call.ok).to be(true)
  end

  it "残高切れは ok=false とコードを返す" do
    allow(client).to receive(:chat).and_raise(quota_error)
    allow(Sentry).to receive(:capture_message)

    result = described_class.call

    expect(result.ok).to be(false)
    expect(result.code).to eq("credit_balance_exhausted")
  end

  # 押した時点の事象も管理画面の「供給側の状態」に反映されるべき
  it "残高切れを検知したら記録する" do
    allow(client).to receive(:chat).and_raise(quota_error)
    allow(Sentry).to receive(:capture_message)

    expect { described_class.call }.to change(ProviderIncident, :count).by(1)
  end

  it "クォータ以外の失敗では記録しない" do
    allow(client).to receive(:chat).and_raise(Faraday::TimeoutError.new("timeout"))

    expect { described_class.call }.not_to change(ProviderIncident, :count)
  end

  # 例外文言に鍵が混ざる経路を塞ぐ
  it "メッセージから API キーを伏せる" do
    allow(client).to receive(:chat).and_raise(StandardError, "failed with key sk-test-key")

    message = described_class.call.message

    expect(message).to include("[REDACTED]")
    expect(message).not_to include("sk-test-key")
  end
end
