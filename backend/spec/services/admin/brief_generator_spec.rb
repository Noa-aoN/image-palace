require "rails_helper"

# 経営の見立て。
#
# **数字はこちらで確定させ、AI には解釈と順番付けだけを任せる。**
# 計算まで任せると、合っているかを確かめる手立てが無いまま数字が出てくる。
RSpec.describe Admin::BriefGenerator do
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:now) { Time.zone.local(2026, 8, 13, 12) }

  let(:answer) do
    {
      highlights: [ "売上は0円のまま", "AI原価 ¥1,250", "未使用クレジット 423cr" ],
      changes: [ "新規登録が前の期間より減っている" ],
      top_issue: "有料の契約がまだ無い",
      actions: [ "初回のカード作成までの導線を見直す", "1枚あたりの原価を毎週見る" ],
      insights: [
        {
          observation: "売上が無いまま固定費だけが出ている",
          evidence: [ "粗利 -7,183円", "インフラ費（期間配賦） 5,933円" ],
          confidence: "high", impact: "high", urgency: "medium",
          suggested_action: "有料の入口を1つに絞って試す"
        },
        {
          observation: "継続率はまだ判断できない",
          evidence: [ "継続率 D30 は immature" ],
          confidence: "low", impact: "medium", urgency: "low",
          suggested_action: "9月中旬まで待つ"
        }
      ]
    }.to_json
  end

  def stub_ai(content: answer, usage: { "prompt_tokens" => 1200, "completion_tokens" => 300 })
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => content } } ], "usage" => usage }
    )
  end

  describe "作る" do
    before { stub_ai }

    it "要点・変化・課題・次にやることを残す" do
      brief = travel_to(now) { described_class.call(user: admin) }

      expect(brief.summary["highlights"].size).to eq(3)
      expect(brief.summary["top_issue"]).to eq("有料の契約がまだ無い")
      expect(brief.summary["actions"].size).to eq(2)
    end

    it "見立てを、根拠つきで残す" do
      brief = travel_to(now) { described_class.call(user: admin) }
      insight = brief.admin_insights.first

      expect(insight.evidence).to include("粗利 -7,183円")
      expect(insight.confidence).to eq("high")
      expect(insight.status).to eq("open")
    end

    it "何を見てそう言ったかを残す（後から辿れる）" do
      brief = travel_to(now) { described_class.call(user: admin) }

      names = brief.facts.map { |fact| fact["name"] }
      expect(names).to include("粗利", "1クレジットあたりの実原価", "未使用クレジット")
    end

    it "どこまで測れていたかを残す" do
      brief = travel_to(now) { described_class.call(user: admin) }

      expect(brief.completeness["retention"]["status"]["d30"]).to eq("immature")
      expect(brief.completeness["activation_funnel"]["status"]).to eq("not_implemented")
    end

    it "使ったモデルと費用を残す" do
      brief = travel_to(now) { described_class.call(user: admin) }

      expect(brief.model).to eq(described_class::MODEL)
      expect(brief.prompt_tokens).to eq(1200)
      expect(brief.cost_points).to be_positive
    end

    it "次にやることは3件まで（多いと、どれもやらないことになる）" do
      stub_ai(content: { top_issue: "x", actions: %w[a b c d e], insights: [] }.to_json)

      brief = travel_to(now) { described_class.call(user: admin) }

      expect(brief.summary["actions"].size).to eq(3)
    end
  end

  describe "受け取らないもの" do
    it "根拠の無い見立ては置かない" do
      stub_ai(content: {
        top_issue: "x", insights: [
          { observation: "なんとなく良くない", evidence: [], confidence: "high",
            impact: "high", urgency: "high", suggested_action: "頑張る" }
        ]
      }.to_json)

      brief = travel_to(now) { described_class.call(user: admin) }

      expect(brief.admin_insights).to be_empty
    end

    it "知らない強さの語は、いちばん弱いものに倒す" do
      stub_ai(content: {
        top_issue: "x", insights: [
          { observation: "o", evidence: [ "粗利 -7,183円" ], confidence: "とても高い",
            impact: "high", urgency: "high", suggested_action: "a" }
        ]
      }.to_json)

      brief = travel_to(now) { described_class.call(user: admin) }

      expect(brief.admin_insights.first.confidence).to eq("low")
    end

    it "読めない応答なら、断って何も残さない" do
      stub_ai(content: "これは JSON ではありません")

      expect { travel_to(now) { described_class.call(user: admin) } }
        .to raise_error(described_class::GenerationError)
      expect(AdminBrief.count).to eq(0)
    end
  end

  describe "前の見立てを壊さない" do
    it "作るのに失敗しても、前のものは残る" do
      stub_ai
      first = travel_to(now) { described_class.call(user: admin) }

      stub_ai(content: "壊れた応答")
      expect { travel_to(now) { described_class.call(user: admin) } }.to raise_error(described_class::GenerationError)

      expect(AdminBrief.recent.first).to eq(first)
      expect(AdminBrief.count).to eq(1)
    end
  end

  describe "二度押し" do
    it "直前に作ったばかりなら、それを使い回す" do
      stub_ai
      first = travel_to(now) { described_class.call(user: admin) }

      expect(travel_to(now + 10.seconds) { AdminBrief.recently_generated }).to eq(first)
      expect(travel_to(now + 5.minutes) { AdminBrief.recently_generated }).to be_nil
    end
  end

  describe "AI へ渡すもの" do
    it "個人を特定できるものを渡さない" do
      create(:user, :confirmed, email: "someone@example.com")
      stub_ai
      payload = nil
      allow(Ai::Chat).to receive(:call) do |args|
        payload = args[:messages].map { |m| m[:content] }.join
        { "choices" => [ { "message" => { "content" => answer } } ], "usage" => {} }
      end

      travel_to(now) { described_class.call(user: admin) }

      expect(payload).not_to include("someone@example.com")
      expect(payload).not_to include(admin.email)
    end

    it "測れていないものは、測れていないと伝える（0 と書かない）" do
      stub_ai
      payload = nil
      allow(Ai::Chat).to receive(:call) do |args|
        payload = args[:messages].map { |m| m[:content] }.join
        { "choices" => [ { "message" => { "content" => answer } } ], "usage" => {} }
      end

      travel_to(now) { described_class.call(user: admin) }

      expect(payload).to include("immature")
      expect(payload).to include("自分で計算し直さない")
    end
  end
end
