# frozen_string_literal: true

require "rails_helper"

# ユーザーの文字列が OpenAI へ渡る**入口**を、ひとつ残らず検査しているか。
#
# 作成のときは検査していたのに、**更新のときは素通り**だった経路が2つあった。
#
#   1. `PATCH /items/:id` の `title`
#      素通しの語でカードを作り、あとから単語を書き換えて作り直しを押せば通せた
#   2. スペースのポイント名
#      `GeneratePointImageJob` が `point.name` をそのまま画像プロンプトに使うのに、
#      作成・更新のどちらにも検査が無かった
#
# ブロックする語はソースに書かない。**実際のブロックリストから引く**ので、
# 経路が本当に `Moderation::PromptModerator` へ繋がっていることまで確かめられる。
# （OpenAI Moderation API は test 環境では既定オフ。ここはローカルの1段目だけを通る）
RSpec.describe "プロンプトの検査", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  # ブロックリストの実物から1語借りる。日本語側は単語境界を見ずに含めば当たる
  let(:ng) { Moderation::PromptModerator.blocklist[:cjk].first }

  before do
    expect(ng).to be_present, "ブロックリストが空。この spec は何も検査できない"
  end

  describe "PATCH /api/v1/items/:id" do
    let(:item_type) { create(:item_type) }
    let(:item) do
      user.items.create!(
        title: "機会費用", item_type: item_type, generation_status: "completed",
        image_description: "ある説明", scene_prompt: "a person at a fork"
      )
    end

    # ここが本丸。単語は `PromptBuilderService` / `Images::BriefResolver` を通って
    # そのまま注文になる。作成時の検査を後から書き換えて回避できてはいけない
    it "単語を違反語へ書き換えられない" do
      patch "/api/v1/items/#{item.id}",
            params: { item: { title: ng } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to match(/利用できない表現/)
      expect(item.reload.title).to eq("機会費用")
    end

    # 説明文も情景を書き起こす入力なので外部へ届く。
    # 以前はここを変えても、検査していたのは `scene_prompt` の**古い値**だった
    it "説明文を違反語へ書き換えられない" do
      patch "/api/v1/items/#{item.id}",
            params: { item: { image_description: ng } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(item.reload.image_description).to eq("ある説明")
    end

    it "情景プロンプトを違反語へ書き換えられない" do
      patch "/api/v1/items/#{item.id}",
            params: { item: { scene_prompt: ng } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(item.reload.scene_prompt).to eq("a person at a fork")
    end

    it "問題のない書き換えは通る" do
      patch "/api/v1/items/#{item.id}",
            params: { item: { title: "サンクコスト" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.reload.title).to eq("サンクコスト")
    end

    # ブロックリストに語を足した日に、既に持っているカードが編集できなくなると困る。
    # 見るのは**変わった値だけ**。作り直しは別の口（`custom_prompt` と作成時）で止まる
    it "変わっていない値では弾かない" do
      item.update_columns(title: ng) # rubocop:disable Rails/SkipsModelValidations

      patch "/api/v1/items/#{item.id}",
            params: { item: { title: ng, image_description: "書き直した説明" } },
            headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.reload.image_description).to eq("書き直した説明")
    end
  end

  describe "スペースのポイント名" do
    let(:space) { create(:space, :road, user: user) }

    it "違反語のポイントは作れない" do
      expect {
        post "/api/v1/spaces/#{space.id}/points",
             params: { name: ng }, headers: headers, as: :json
      }.not_to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to match(/利用できない表現/)
      expect(space.space_points.count).to eq(0)
    end

    # 弾くと分かっているものに課金しない。検査は残高の確認より先に置いてある
    it "違反語で弾いたときクレジットは減らない" do
      user.ensure_current_period_credits!
      before_credits = user.reload.available_credit_points

      post "/api/v1/spaces/#{space.id}/points",
           params: { name: ng }, headers: headers, as: :json

      expect(user.reload.available_credit_points).to eq(before_credits)
    end

    it "作成後に違反語へ改名できない" do
      point = space.space_points.create!(position: 1, name: "玄関")

      expect {
        patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
              params: { name: ng }, headers: headers, as: :json
      }.not_to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(point.reload.name).to eq("玄関")
    end

    it "問題のない名前は通る" do
      expect {
        post "/api/v1/spaces/#{space.id}/points",
             params: { name: "玄関" }, headers: headers, as: :json
      }.to have_enqueued_job(GeneratePointImageJob)

      expect(response).to have_http_status(:created)
    end

    # 座標を動かすたびに検査へ入ると、ドラッグのたびに外部 API を叩くことになる。
    # 名前が変わったときだけ見る
    it "名前を変えない更新では検査しない" do
      point = space.space_points.create!(position: 1, name: "玄関")
      expect(Moderation::PromptModerator).not_to receive(:call)

      patch "/api/v1/spaces/#{space.id}/points/#{point.id}",
            params: { x: 10, y: 20 }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
    end
  end
end
