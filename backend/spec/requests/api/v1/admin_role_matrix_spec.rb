require "rails_helper"

# 段階ごとに、どこまで触れるかを表で押さえる。
#
# 認可は**書き忘れると通ってしまう**方向に壊れる。一覧で持たずに各コントローラへ
# 書く方針なので、足したエンドポイントに付け忘れても誰も気づかない。
# ここで「support は書き換えられない」「operator はお金を触れない」を固定する。
RSpec.describe "運営の段階ごとに触れる範囲", type: :request do
  let(:support) { create(:user, :confirmed, role: "support") }
  let(:operator) { create(:user, :confirmed, role: "operator") }
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:member) { create(:user, :confirmed, role: "user") }

  def headers_for(user) = auth_headers_for(user)

  # 読むだけの入口。support 以上なら通る
  READABLE = [
    [ :get, "/api/v1/admin/overview" ],
    # 経営の数字。読むだけなので support も見られる
    [ :get, "/api/v1/admin/business" ],
    [ :get, "/api/v1/admin/users" ],
    [ :get, "/api/v1/admin/audit_logs" ],
    [ :get, "/api/v1/admin/finance" ],
    [ :get, "/api/v1/admin/plans" ],
    [ :get, "/api/v1/admin/rewards" ],
    [ :get, "/api/v1/admin/posts" ],
    [ :get, "/api/v1/admin/feature_flags" ],
    [ :get, "/api/v1/admin/grant_policies" ],
    [ :get, "/api/v1/admin/ai_models" ],
    [ :get, "/api/v1/admin/campaign_codes" ],
    # 経営の見立て。読むだけ（作るのは operator 以上）
    [ :get, "/api/v1/admin/brief" ],
    [ :get, "/api/v1/admin/briefs" ],
    [ :get, "/api/v1/admin/brief_actions" ]
  ].freeze

  # 通常運用。operator 以上でないと通らない
  OPERATOR_ONLY = [
    [ :post, "/api/v1/admin/campaign_codes" ],
    [ :post, "/api/v1/admin/ai_models" ],
    [ :post, "/api/v1/admin/posts" ],
    [ :post, "/api/v1/admin/rewards/grant" ],
    [ :post, "/api/v1/admin/provider_check" ],
    [ :put, "/api/v1/admin/feature_flags/page.trophy" ],
    [ :put, "/api/v1/admin/grant_policies/free_monthly" ],
    # 見立てを作る。AI を呼ぶので費用が出るし、記録として残る
    [ :post, "/api/v1/admin/brief" ]
  ].freeze

  # お金と権限。admin でないと通らない。
  #
  # 公式工房もここ。**招待の仕組みがまだ無い段階で operator へ開くと、
  # 運営業務の担当者が公式コンテンツを触れることになり、職務が分かれない**
  ADMIN_ONLY = [
    [ :put, "/api/v1/admin/finance/parameters/image_cost" ],
    [ :put, "/api/v1/admin/finance/actuals/2026/8" ],
    [ :get, "/api/v1/admin/studio" ],
    [ :get, "/api/v1/admin/studio/settings" ],
    [ :patch, "/api/v1/admin/studio/settings" ],
    [ :get, "/api/v1/admin/studio/sources" ],
    [ :post, "/api/v1/admin/studio/draft" ],
    [ :post, "/api/v1/admin/studio/starter_x/1/preview" ],
    [ :delete, "/api/v1/admin/studio/starter_x/1/preview" ],
    [ :patch, "/api/v1/admin/studio/starter_x/1/status" ]
  ].freeze

  describe "一般利用者" do
    it "運営の入口に入れない" do
      (READABLE + OPERATOR_ONLY + ADMIN_ONLY).each do |verb, path|
        public_send(verb, path, headers: headers_for(member))
        expect(response).to have_http_status(:forbidden), "#{verb.upcase} #{path} が通ってしまった"
      end
    end
  end

  describe "support（見るだけ）" do
    it "閲覧はできる" do
      READABLE.each do |verb, path|
        public_send(verb, path, headers: headers_for(support))
        expect(response).not_to have_http_status(:forbidden), "#{verb.upcase} #{path} が閲覧できない"
      end
    end

    # ここが崩れると「見るだけ」のはずの人が配れてしまう
    it "通常運用の操作はできない" do
      OPERATOR_ONLY.each do |verb, path|
        public_send(verb, path, headers: headers_for(support))
        expect(response).to have_http_status(:forbidden), "#{verb.upcase} #{path} が通ってしまった"
      end
    end

    it "お金の操作はできない" do
      ADMIN_ONLY.each do |verb, path|
        public_send(verb, path, headers: headers_for(support))
        expect(response).to have_http_status(:forbidden), "#{verb.upcase} #{path} が通ってしまった"
      end
    end
  end

  describe "operator（通常運用）" do
    # 中身の検証まではしない。ここで見たいのは「門を通れるか」だけ
    it "通常運用の操作で権限を理由に断られない" do
      OPERATOR_ONLY.each do |verb, path|
        public_send(verb, path, headers: headers_for(operator))
        expect(response).not_to have_http_status(:forbidden), "#{verb.upcase} #{path} で断られた"
      end
    end

    # プラン・収支の値は課金の根幹。通常運用では触らせない
    it "お金の操作はできない" do
      ADMIN_ONLY.each do |verb, path|
        public_send(verb, path, headers: headers_for(operator))
        expect(response).to have_http_status(:forbidden), "#{verb.upcase} #{path} が通ってしまった"
      end
    end

    it "役割は変えられない" do
      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "operator" }, headers: headers_for(operator)

      expect(response).to have_http_status(:forbidden)
      expect(member.reload.role).to eq("user")
    end
  end

  describe "admin（最上位）" do
    it "お金の操作で権限を理由に断られない" do
      ADMIN_ONLY.each do |verb, path|
        public_send(verb, path, headers: headers_for(admin))
        expect(response).not_to have_http_status(:forbidden), "#{verb.upcase} #{path} で断られた"
      end
    end

    it "役割を変えられる" do
      # 権限を触るには、直近に本人か確かめている必要がある
      admin_headers = headers_for(admin)
      StrongAuthSession.record!(user: admin, client_id: admin_headers["client"], method: "passkey")

      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "support" }, headers: admin_headers

      expect(response).to have_http_status(:success)
      expect(member.reload.role).to eq("support")
    end
  end

  # 認可の書き忘れを機械的に見つける。
  # 新しく生えたエンドポイントは、この表に載っていなければ気づけない
  describe "表の網羅" do
    it "admin 名前空間の経路が、どれかの表に載っている" do
      listed = (READABLE + OPERATOR_ONLY + ADMIN_ONLY).map { |_, path| path.split("/").reject { |s| s.match?(/\A[\d.]/) } }
      paths = Rails.application.routes.routes.map { |r| r.path.spec.to_s.sub("(.:format)", "") }
                   .select { |p| p.start_with?("/api/v1/admin/") }
                   .reject { |p| p.include?("/session") } # 権限の確認そのもの。誰でも呼べる

      missing = paths.reject do |path|
        prefix = path.split("/").reject { |s| s.start_with?(":") }
        listed.any? { |l| l.first(prefix.size) == prefix || prefix.first(l.size) == l }
      end

      expect(missing).to be_empty, "表に無い経路: #{missing.join(', ')}"
    end
  end
end
