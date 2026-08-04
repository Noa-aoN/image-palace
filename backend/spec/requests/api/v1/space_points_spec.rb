require "rails_helper"

RSpec.describe "Api::V1::SpacePoints", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:space) { create(:space, :road, user: user) }

  describe "POST /api/v1/spaces/:space_id/points" do
    it "名前付きポイントを作成し、画像生成ジョブを積む" do
      expect {
        post "/api/v1/spaces/#{space.id}/points",
          params: { name: "玄関" }, headers: headers, as: :json
      }.to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("玄関")
      expect(json_response["position"]).to eq(1)
      expect(json_response["generation_status"]).to eq("pending")
    end

    it "名前なしの空ポイントは生成ジョブを積まない" do
      expect {
        post "/api/v1/spaces/#{space.id}/points", headers: headers, as: :json
      }.not_to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to be_nil
    end

    it "クレジット残高が不足している場合は名前付きポイントを作れない" do
      user.ensure_current_period_credits!
      user.update!(subscription_credits: 0, topup_credits: 0)
      user.credit_grants.destroy_all
      user.mark_trial_granted!

      expect {
        post "/api/v1/spaces/#{space.id}/points",
          params: { name: "玄関" }, headers: headers, as: :json
      }.not_to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to include("クレジット")
    end

    it "他人のスペースには作成できない" do
      other_space = create(:space, :road, user: create(:user, :confirmed))

      post "/api/v1/spaces/#{other_space.id}/points",
        params: { name: "玄関" }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/spaces/:space_id/points/:id" do
    it "ポイント名を変更すると画像を再生成する" do
      point = create(:space_point, space: space, name: "玄関", generation_status: "completed")

      expect {
        patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
          params: { name: "台所" }, headers: headers, as: :json
      }.to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:ok)
      expect(json_response["name"]).to eq("台所")
      expect(json_response["generation_status"]).to eq("pending")
    end

    it "同じ名前で生成済みなら再生成しない" do
      point = create(:space_point, space: space, name: "玄関", generation_status: "completed")

      expect {
        patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
          params: { name: "玄関" }, headers: headers, as: :json
      }.not_to have_enqueued_job(GeneratePointImageJob)
    end

    it "前回失敗したポイントは同じ名前でも再試行できる" do
      point = create(:space_point, space: space, name: "玄関", generation_status: "failed")

      expect {
        patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
          params: { name: "玄関" }, headers: headers, as: :json
      }.to have_enqueued_job(GeneratePointImageJob)
    end

    it "generate: false のときは改名しても生成せず名前だけ保存する（カード配置時に使う）" do
      point = create(:space_point, space: space, name: "玄関", generation_status: "completed")

      expect {
        patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
          params: { name: "犬", generate: false }, headers: headers, as: :json
      }.not_to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:ok)
      expect(point.reload.name).to eq("犬")
      expect(point.generation_status).to eq("completed")
    end

    it "generate: false の改名ではクレジットを消費しない" do
      point = create(:space_point, space: space, name: "玄関", generation_status: "completed")
      user.ensure_current_period_credits!
      before = user.available_credit_points

      patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
        params: { name: "犬", generate: false }, headers: headers, as: :json

      expect(user.reload.available_credit_points).to eq(before)
    end

    it "generate: true のときは同じ名前でも生成する" do
      point = create(:space_point, space: space, name: "玄関", generation_status: "completed")

      expect {
        patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
          params: { name: "玄関", generate: true }, headers: headers, as: :json
      }.to have_enqueued_job(GeneratePointImageJob)
    end

    it "間取り座標（x/y）を更新できる" do
      point = create(:space_point, space: space, position: 1)

      patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
        params: { x: 120.5, y: 80 }, headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(point.reload.x).to eq(120.5)
      expect(point.y).to eq(80.0)
    end

    it "面と面内座標（surface/u/v）を更新し、レスポンスに含める" do
      point = create(:space_point, space: space, position: 1)

      patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
        params: { surface: "wall_north", u: 0.3, v: 0.6 }, headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(point.reload.surface).to eq("wall_north")
      expect(point.u).to eq(0.3)
      expect(point.v).to eq(0.6)
      expect(json_response).to include("surface" => "wall_north", "u" => 0.3, "v" => 0.6)
    end

    it "面内座標は 0..1 にクランプして保存する" do
      point = create(:space_point, space: space, position: 1)

      patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
        params: { u: 2.0, v: -1.0 }, headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(point.reload.u).to eq(1.0)
      expect(point.v).to eq(0.0)
    end
  end

  describe "月間生成数の合算" do
    it "名前付きポイントが items サマリの月間カウントに含まれる" do
      create(:space_point, space: space, name: "玄関")

      get "/api/v1/items/summary", headers: headers, as: :json

      expect(json_response["monthly_count"]).to eq(1)
    end
  end

  describe "画像の回転" do
    let(:space) { create(:space, user: user) }
    let!(:point) { create(:space_point, space: space, position: 1) }

    it "3軸の回転を更新して返す" do
      patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
        params: { rotation_x: 30, rotation_y: -45, rotation_z: 90 }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(point.reload.rotation_x).to eq(30.0)
      expect(point.rotation_y).to eq(-45.0)
      expect(point.rotation_z).to eq(90.0)
      expect(json_response).to include("rotation_x" => 30.0, "rotation_y" => -45.0, "rotation_z" => 90.0)
    end

    it "一周を超える角度は畳んで保存する" do
      patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
        params: { rotation_z: 450 }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(point.reload.rotation_z).to eq(90.0)
    end
  end
end
