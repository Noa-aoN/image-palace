require "rails_helper"

# AI に返させる長さの上限。
#
# **上限が無いと、返事の長さが費用と待ち時間をそのまま決める。**
# ここで止めているのは暴発であって、ふだんの長さではない。
RSpec.describe "AI の返す長さの上限" do
  let(:user) { create(:user, :confirmed) }

  before do
    user.grant_credits!(1000, kind: "campaign", expires_at: 1.month.from_now)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_return("test-key")
  end

  def captured_parameters
    captured = nil
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat) do |args|
      captured = args[:parameters]
      { "choices" => [ { "message" => { "content" => "ok" } } ], "usage" => {} }
    end
    yield
    captured
  end

  it "何も指定しなければ、上限が付く" do
    params = captured_parameters do
      Ai::Chat.call(kind: "meaning", user: user, model: "gpt-4o-mini", messages: [ { role: "user", content: "x" } ])
    end

    expect(params[:max_tokens]).to eq(Ai::Chat::DEFAULT_MAX_TOKENS)
  end

  it "呼び出し側が決めていれば、そちらを使う" do
    params = captured_parameters do
      Ai::Chat.call(kind: "meaning", user: user, model: "gpt-4o-mini",
                    messages: [ { role: "user", content: "x" } ], max_tokens: 50)
    end

    expect(params[:max_tokens]).to eq(50)
  end

  it "ほかの指定を消さない" do
    params = captured_parameters do
      Ai::Chat.call(kind: "meaning", user: user, model: "gpt-4o-mini",
                    messages: [ { role: "user", content: "x" } ],
                    temperature: 0.2, response_format: { type: "json_object" })
    end

    expect(params[:temperature]).to eq(0.2)
    expect(params[:response_format]).to eq({ type: "json_object" })
    expect(params[:max_tokens]).to eq(Ai::Chat::DEFAULT_MAX_TOKENS)
  end
end
