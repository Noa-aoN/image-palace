require "rails_helper"

RSpec.describe "Api::V1::Views AI編集", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }
  let(:view) { user.views.create!(name: "テスト", view_type: "deck") }

  let!(:a) { user.items.create!(title: "あ", item_type: item_type, generation_status: "completed") }
  let!(:b) { user.items.create!(title: "い", item_type: item_type, generation_status: "completed") }

  before do
    view.view_items.create!(item: a, position: 1)
    view.view_items.create!(item: b, position: 2)
  end

  def stub_plan(plan)
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    )
  end

  it "未ログインでは編集できない" do
    post "/api/v1/views/#{view.id}/ai_edit", params: { edit: { instruction: "並べ替えて" } }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "他人のキャンバスは編集できない" do
    theirs = create(:user, :confirmed).views.create!(name: "他人", view_type: "deck")

    post "/api/v1/views/#{theirs.id}/ai_edit",
         params: { edit: { instruction: "並べ替えて" } }, headers: headers, as: :json

    expect(response).to have_http_status(:not_found)
  end

  it "編集後の内容と、何をしたかを返す" do
    stub_plan("summary" => "逆順にしました", "order" => [ b.id, a.id ])

    post "/api/v1/views/#{view.id}/ai_edit",
         params: { edit: { instruction: "逆順にして" } }, headers: headers, as: :json

    expect(response).to have_http_status(:success)
    expect(json_response["ai_edit"]["summary"]).to eq("逆順にしました")
    expect(json_response["items"].map { |i| i["item_id"] }).to eq([ b.id, a.id ])
  end

  it "指示が空なら 422" do
    post "/api/v1/views/#{view.id}/ai_edit",
         params: { edit: { instruction: "" } }, headers: headers, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json_response["error"]).to be_present
  end

  it "利用上限に達していれば 429 で理由を返す" do
    allow(Ai::Chat).to receive(:call).and_raise(Ai::Chat::LimitExceeded, "クレジットが不足しています")

    post "/api/v1/views/#{view.id}/ai_edit",
         params: { edit: { instruction: "並べ替えて" } }, headers: headers, as: :json

    expect(response).to have_http_status(:too_many_requests)
    expect(json_response["error"]).to eq("クレジットが不足しています")
  end

  it "AI が落ちてもキャンバスは壊れない" do
    allow(Ai::Chat).to receive(:call).and_raise(Faraday::TimeoutError, "timeout")

    post "/api/v1/views/#{view.id}/ai_edit",
         params: { edit: { instruction: "並べ替えて" } }, headers: headers, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(view.reload.view_items.order(:position).pluck(:item_id)).to eq([ a.id, b.id ])
  end
end
