require "rails_helper"

# キャンバス／スペース／ボックスは同じ仕組み（CoverImageGeneration）でカバーを作る。
# 3つとも同じように振る舞うことを、同じ例で確かめる。
RSpec.describe "カバー画像の生成", type: :request do
  TARGETS = {
    "キャンバス" => { path: "views", factory: :view },
    "スペース" => { path: "spaces", factory: :space },
    "ボックス" => { path: "boxes", factory: :box }
  }.freeze

  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  before { user.ensure_current_period_credits! }

  # 3種とも同じ扱いにするための最小の生成ヘルパ
  def build_record(owner, factory)
    case factory
    when :view then owner.views.create!(name: "テスト", view_type: "deck")
    when :space then owner.spaces.create!(name: "テスト", space_type: "room")
    when :box then owner.boxes.create!(name: "テスト")
    end
  end

  TARGETS.each do |target_label, target_config|
    describe target_label do
      let(:config) { target_config }
      let(:record) { build_record(user, config[:factory]) }
      let(:url) { "/api/v1/#{config[:path]}/#{record.id}/cover_image/generate" }

      it "未ログインでは作れない" do
        post url, params: { cover: { prompt: "森の入口" } }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end

      it "ジョブを積み、クレジットを前払いで消費する" do
        before_points = user.available_credit_points

        expect {
          post url, params: { cover: { prompt: "森の入口", style: "watercolor" } }, headers: headers, as: :json
        }.to have_enqueued_job(GenerateCoverImageJob)

        expect(response).to have_http_status(:accepted)
        expect(json_response["cover_generation_status"]).to eq("pending")
        expect(record.reload.cover_generation_status).to eq("pending")
        expect(user.reload.available_credit_points).to eq(before_points - ::Billing::CreditCost.call(kind: :cover))
      end

      it "プロンプトが空なら作らない" do
        expect {
          post url, params: { cover: { prompt: "  " } }, headers: headers, as: :json
        }.not_to have_enqueued_job(GenerateCoverImageJob)

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "プロンプトが長すぎれば作らない" do
        post url,
             params: { cover: { prompt: "あ" * (CoverImageGeneration::MAX_COVER_PROMPT + 1) } },
             headers: headers, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "すでに生成中なら二重に受け付けない（クレジットの二重消費を防ぐ）" do
        record.update!(cover_generation_status: "processing")
        before_points = user.available_credit_points

        expect {
          post url, params: { cover: { prompt: "森の入口" } }, headers: headers, as: :json
        }.not_to have_enqueued_job(GenerateCoverImageJob)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(user.reload.available_credit_points).to eq(before_points)
      end

      it "クレジットが足りなければ作らない" do
        user.update!(subscription_credits: 0, topup_credits: 0)
        user.credit_grants.destroy_all

        expect {
          post url, params: { cover: { prompt: "森の入口" } }, headers: headers, as: :json
        }.not_to have_enqueued_job(GenerateCoverImageJob)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_response["error"]).to eq("クレジットが不足しています")
      end

      it "不適切な語は作らず、クレジットも消費しない" do
        allow(Moderation::PromptModerator).to receive(:call)
          .and_return(Moderation::PromptModerator::Result.new(allowed: false, category: "test", term: "ng"))
        before_points = user.available_credit_points

        expect {
          post url, params: { cover: { prompt: "だめな語" } }, headers: headers, as: :json
        }.not_to have_enqueued_job(GenerateCoverImageJob)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(user.reload.available_credit_points).to eq(before_points)
      end

      it "他人のものには作れない" do
        theirs = build_record(create(:user, :confirmed), config[:factory])

        post "/api/v1/#{config[:path]}/#{theirs.id}/cover_image/generate",
             params: { cover: { prompt: "森" } }, headers: headers, as: :json

        expect(response).to have_http_status(:not_found)
      end

      it "生成状態を詳細に含める" do
        record.update!(cover_generation_status: "failed", cover_generation_error: "だめでした")

        get "/api/v1/#{config[:path]}/#{record.id}", headers: headers

        expect(json_response["cover_generation_status"]).to eq("failed")
        expect(json_response["cover_generation_error"]).to eq("だめでした")
      end
    end
  end
end
