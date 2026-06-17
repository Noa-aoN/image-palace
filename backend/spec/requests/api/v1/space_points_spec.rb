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

    it "月間生成上限に達している場合は名前付きポイントを作れない" do
      allow_any_instance_of(User).to receive(:monthly_generation_count)
        .and_return(Items::CreateService::FREE_ITEM_LIMIT_PER_MONTH)

      expect {
        post "/api/v1/spaces/#{space.id}/points",
          params: { name: "玄関" }, headers: headers, as: :json
      }.not_to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to include("上限")
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
  end

  describe "月間生成数の合算" do
    it "名前付きポイントが items サマリの月間カウントに含まれる" do
      create(:space_point, space: space, name: "玄関")

      get "/api/v1/items/summary", headers: headers, as: :json

      expect(json_response["monthly_count"]).to eq(1)
    end
  end
end
