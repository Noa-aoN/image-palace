require "rails_helper"

# 経営の見立ての入口。
#
# **開くだけでは作らない。** 明示的に更新したときだけ AI を呼ぶ。
RSpec.describe "経営の見立て", type: :request do
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:member) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(admin) }

  before { StrongAuthSession.record!(user: admin, client_id: headers["client"], method: "passkey") }

  let(:answer) do
    {
      highlights: [ "売上は0円のまま" ],
      changes: [],
      top_issue: "有料の契約がまだ無い",
      actions: [ "初回の導線を見直す" ],
      insights: [
        {
          observation: "固定費だけが出ている",
          evidence: [ "粗利 -7,183円" ],
          confidence: "high", impact: "high", urgency: "medium",
          suggested_action: "有料の入口を1つに絞る"
        }
      ]
    }.to_json
  end

  def stub_ai
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => answer } } ], "usage" => { "prompt_tokens" => 900 } }
    )
  end

  describe "読む" do
    it "まだ無ければ null（作りに行かない）" do
      expect(Ai::Chat).not_to receive(:call)

      get "/api/v1/admin/brief", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response["brief"]).to be_nil
    end

    it "作ったものが、読み直しても残っている" do
      stub_ai
      post "/api/v1/admin/brief", headers: headers

      get "/api/v1/admin/brief", headers: headers

      expect(json_response["brief"]["summary"]["top_issue"]).to eq("有料の契約がまだ無い")
      expect(json_response["brief"]["insights"].first["evidence"]).to eq([ "粗利 -7,183円" ])
    end
  end

  describe "作る" do
    it "運営が押せば作られ、記録に残る" do
      stub_ai

      expect { post "/api/v1/admin/brief", headers: headers }
        .to change(AdminBrief, :count).by(1)
        .and change { AdminAuditLog.where(action: "admin.brief_generated").count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["brief"]["cost_credits"]).to be_present
    end

    it "続けて押しても、同じものを返すだけ（二度作らない）" do
      stub_ai
      post "/api/v1/admin/brief", headers: headers
      first_id = json_response["brief"]["id"]

      expect { post "/api/v1/admin/brief", headers: headers }.not_to change(AdminBrief, :count)
      expect(json_response["brief"]["id"]).to eq(first_id)
    end

    it "AI が読めない応答を返しても、前のものは壊れない" do
      stub_ai
      post "/api/v1/admin/brief", headers: headers
      first_id = json_response["brief"]["id"]

      travel_to(5.minutes.from_now) do
        allow(Ai::Chat).to receive(:call).and_return(
          { "choices" => [ { "message" => { "content" => "壊れた応答" } } ], "usage" => {} }
        )
        post "/api/v1/admin/brief", headers: headers
        expect(response).to have_http_status(:unprocessable_entity)

        get "/api/v1/admin/brief", headers: headers
        expect(json_response["brief"]["id"]).to eq(first_id)
      end
    end
  end

  describe "誰が開けるか" do
    it "運営でない人は開けない" do
      get "/api/v1/admin/brief", headers: auth_headers_for(member)

      expect(response).to have_http_status(:forbidden)
    end

    it "強い確認を通していない運営は開けない" do
      allow(Auth::StrongAuth).to receive(:admin_required?).and_return(true)
      other = create(:user, :confirmed, role: "admin")

      get "/api/v1/admin/brief", headers: auth_headers_for(other)

      expect(response).to have_http_status(:forbidden)
    end
  end
end
