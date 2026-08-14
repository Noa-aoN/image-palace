require "rails_helper"

# 「次にやること」。**終わったかどうかだけ**を持つ。
#
# 見立て（admin_insights）とは1対1ではない。AI は別々に書くので、数も中身も対応しない。
# 見立ての status を「終わったか」に流用すると、
# **AI が何を言ったか**と**人が何をやったか**が混ざる。
RSpec.describe "次にやること", type: :request do
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:headers) { auth_headers_for(admin) }

  before { StrongAuthSession.record!(user: admin, client_id: headers["client"], method: "passkey") }

  def brief_with_actions(titles, generated_at: Time.current)
    brief = AdminBrief.create!(
      period_key: "30d", period_from: 30.days.ago, period_to: Time.current,
      summary: { "actions" => titles }, model: "gpt-4o-mini", facts: [], completeness: {}
    )
    brief.update_column(:created_at, generated_at)
    titles.each_with_index { |title, index| brief.admin_brief_actions.create!(title: title, position: index) }
    brief
  end

  describe "一覧" do
    it "既定は未完了だけ（まず残っているものを見る）" do
      brief = brief_with_actions([ "導線を見直す", "原価を毎週見る" ])
      brief.admin_brief_actions.first.done!

      get "/api/v1/admin/brief_actions", headers: headers

      expect(json_response["filter"]).to eq("open")
      expect(json_response["actions"].map { |a| a["title"] }).to eq([ "原価を毎週見る" ])
    end

    it "完了・すべても選べる" do
      brief = brief_with_actions([ "A", "B" ])
      brief.admin_brief_actions.first.done!

      get "/api/v1/admin/brief_actions", params: { status: "done" }, headers: headers
      expect(json_response["actions"].map { |a| a["title"] }).to eq([ "A" ])

      get "/api/v1/admin/brief_actions", params: { status: "all" }, headers: headers
      expect(json_response["actions"].size).to eq(2)
    end

    it "知らない絞り込みは未完了に倒す" do
      get "/api/v1/admin/brief_actions", params: { status: "なんでも" }, headers: headers

      expect(json_response["filter"]).to eq("open")
    end

    it "新しい見立てのものが上に来る" do
      brief_with_actions([ "古い" ], generated_at: 3.days.ago)
      brief_with_actions([ "新しい" ], generated_at: 1.hour.ago)

      get "/api/v1/admin/brief_actions", params: { status: "all" }, headers: headers

      expect(json_response["actions"].map { |a| a["title"] }).to eq([ "新しい", "古い" ])
    end

    it "いつ言われたことかが分かる（古いまま残っているものに気づける）" do
      brief_with_actions([ "A" ], generated_at: 5.days.ago)

      get "/api/v1/admin/brief_actions", headers: headers

      expect(json_response["actions"].first["generated_at"]).to be_present
    end
  end

  describe "チェック" do
    it "終わったことにできる" do
      brief = brief_with_actions([ "導線を見直す" ])
      action = brief.admin_brief_actions.first

      patch "/api/v1/admin/brief_actions/#{action.id}", params: { status: "done" }, headers: headers

      expect(json_response["action"]["status"]).to eq("done")
      expect(action.reload.completed_at).to be_present
    end

    it "戻せる（押し間違いを直せる）" do
      brief = brief_with_actions([ "A" ])
      action = brief.admin_brief_actions.first
      action.done!

      patch "/api/v1/admin/brief_actions/#{action.id}", params: { status: "open" }, headers: headers

      expect(action.reload.status).to eq("open")
      expect(action.completed_at).to be_nil
    end

    it "終わっても消さない（やったことも、次の見立ての材料になる）" do
      brief = brief_with_actions([ "A" ])
      action = brief.admin_brief_actions.first

      expect {
        patch "/api/v1/admin/brief_actions/#{action.id}", params: { status: "done" }, headers: headers
      }.not_to change(AdminBriefAction, :count)
    end

    it "見立てそのものは書き換えない" do
      brief = brief_with_actions([ "A" ])
      insight = brief.admin_insights.create!(
        observation: "固定費だけが出ている", evidence: [ "粗利 -7,183円" ],
        confidence: "high", impact: "high", urgency: "medium", suggested_action: "入口を絞る"
      )
      action = brief.admin_brief_actions.first

      patch "/api/v1/admin/brief_actions/#{action.id}", params: { status: "done" }, headers: headers

      expect(insight.reload.status).to eq("open")
      expect(insight.observation).to eq("固定費だけが出ている")
    end
  end

  describe "履歴" do
    it "新しいものが上に並ぶ" do
      brief_with_actions([ "古い" ], generated_at: 3.days.ago)
      brief_with_actions([ "新しい" ], generated_at: 1.hour.ago)

      get "/api/v1/admin/briefs", headers: headers

      titles = json_response["briefs"].map { |b| b["actions"].first["title"] }
      expect(titles).to eq([ "新しい", "古い" ])
    end

    it "1件ずつに、期間・モデル・費用・どこまで測れていたかが付く" do
      brief_with_actions([ "A" ])

      get "/api/v1/admin/briefs", headers: headers

      row = json_response["briefs"].first
      expect(row).to include("period", "model", "cost_credits", "completeness", "insights", "actions")
    end
  end
end
