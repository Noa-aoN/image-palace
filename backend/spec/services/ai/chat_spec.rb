require "rails_helper"

RSpec.describe Ai::Chat do
  let(:user) { create(:user, :confirmed) }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_return("test-key")
  end

  def stub_client(response)
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat).and_return(response)
    client
  end

  let(:response) do
    {
      "choices" => [ { "message" => { "content" => "{}" } } ],
      "usage" => { "prompt_tokens" => 120, "completion_tokens" => 30 }
    }
  end

  let(:messages) { [ { role: "user", content: "こんにちは" } ] }

  it "応答をそのまま返す（呼び出し側の解析は変えない）" do
    stub_client(response)

    result = described_class.call(kind: "meaning", user: user, model: "gpt-4o-mini", messages: messages)

    expect(result).to eq(response)
  end

  it "利用を記録する" do
    stub_client(response)

    expect {
      described_class.call(kind: "meaning", user: user, model: "gpt-4o-mini", messages: messages)
    }.to change(AiUsage, :count).by(1)

    usage = AiUsage.last
    expect(usage.user_id).to eq(user.id)
    expect(usage.kind).to eq("meaning")
    expect(usage.model).to eq("gpt-4o-mini")
    expect(usage.prompt_tokens).to eq(120)
    expect(usage.completion_tokens).to eq(30)
    expect(usage.cost_points).to eq(1)
  end

  it "usage が無い応答でも記録は残す（0 トークン扱い）" do
    stub_client({ "choices" => [ { "message" => { "content" => "{}" } } ] })

    described_class.call(kind: "tags", user: user, model: "gpt-4o-mini", messages: messages)

    expect(AiUsage.last.prompt_tokens).to eq(0)
  end

  it "指定したパラメータをそのまま渡す" do
    client = stub_client(response)

    described_class.call(
      kind: "meaning", user: user, model: "gpt-4o-mini", messages: messages,
      temperature: 0.4, response_format: { type: "json_object" }
    )

    expect(client).to have_received(:chat) do |parameters:|
      expect(parameters[:model]).to eq("gpt-4o-mini")
      expect(parameters[:temperature]).to eq(0.4)
      expect(parameters[:response_format]).to eq({ type: "json_object" })
      # request_timeout はクライアント側の設定であってリクエスト本文ではない
      expect(parameters).not_to have_key(:request_timeout)
    end
  end

  it "記録に失敗しても生成そのものは通す" do
    stub_client(response)
    allow(AiUsage).to receive(:create!).and_raise(ActiveRecord::StatementInvalid, "boom")

    expect {
      described_class.call(kind: "meaning", user: user, model: "gpt-4o-mini", messages: messages)
    }.not_to raise_error
  end

  # 以前は課金と記録が同じ rescue の中にあり、課金が落ちると記録ごと消えていた。
  # 取りこぼしたことすら分からなくなるので、記録だけは必ず残す
  it "課金に失敗しても生成は通し、記録は 0pt で残す" do
    stub_client(response)
    allow(Ai::UsageLimit).to receive(:charge!).and_raise(User::InsufficientCredits)

    expect {
      described_class.call(kind: "meaning", user: user, model: "gpt-4o-mini", messages: messages)
    }.to change(AiUsage, :count).by(1)

    expect(AiUsage.last.cost_points).to eq(0)
  end

  it "ユーザーが分からない呼び出しでも記録は残す" do
    stub_client(response)

    described_class.call(kind: "words_generate", model: "gpt-4o-mini", messages: messages)

    expect(AiUsage.last.user_id).to be_nil
  end

  context "1日の上限に達しているとき" do
    before do
      allow(Ai::UsageLimit).to receive(:daily_call_cap).and_return(2)
      2.times { AiUsage.create!(user: user, kind: "meaning", model: "m", created_at: Time.current) }
    end

    it "呼び出さずに LimitExceeded を投げる" do
      expect(OpenAI::Client).not_to receive(:new)

      expect {
        described_class.call(kind: "meaning", user: user, model: "gpt-4o-mini", messages: messages)
      }.to raise_error(described_class::LimitExceeded)
    end

    it "24時間より前の利用は数えない" do
      AiUsage.update_all(created_at: 25.hours.ago)
      stub_client(response)

      expect {
        described_class.call(kind: "meaning", user: user, model: "gpt-4o-mini", messages: messages)
      }.not_to raise_error
    end
  end

  context "有料の種類のとき" do
    before do
      allow(Ai::UsageLimit).to receive(:cost_points).and_return(1)
      user.ensure_current_period_credits!
    end

    it "クレジットを消費して、消費ぶんを記録に残す" do
      stub_client(response)
      before_points = user.available_credit_points

      described_class.call(kind: "fact_check", user: user, model: "gpt-4o", messages: messages)

      expect(user.reload.available_credit_points).to eq(before_points - 1)
      expect(AiUsage.last.cost_points).to eq(1)
    end

    it "残高が足りなければ呼び出さない" do
      user.update!(subscription_credits: 0, topup_credits: 0)
      user.credit_grants.destroy_all
      expect(OpenAI::Client).not_to receive(:new)

      expect {
        described_class.call(kind: "fact_check", user: user, model: "gpt-4o", messages: messages)
      }.to raise_error(described_class::LimitExceeded, /クレジット/)
    end
  end
end
