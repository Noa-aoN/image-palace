# frozen_string_literal: true

require "rails_helper"

# 戻り先を、自分たちのフロントだけに絞れているか。
#
# devise_token_auth は `redirect_url` / `confirm_success_url` に指定された先へ
# **トークンを付けて飛ばす**。許可リストが無いと、
# 「パスワードをお忘れですか」を1回踏ませるだけでアカウントを奪える。
#
#   passwords#edit … メールのリンクの着地点。`reset_password_token` をクエリに載せる
#   registrations  … `confirm_success_url` を検査する（確認メールを止めていても通る）
#
# 試験環境の許可オリジンは `http://localhost:3000`（`.env` の FRONTEND_URL）。
RSpec.describe "戻り先の許可リスト", type: :request do
  let(:user) { create(:user, :confirmed) }

  # 素通しにしていないこと。ここが nil だと以下の検査はすべて意味を失う
  it "許可リストが設定されている" do
    expect(DeviseTokenAuth.redirect_whitelist).to be_present
  end

  describe "パスワード再設定の要求（POST /api/v1/auth/password）" do
    it "自分たちのフロントなら通る" do
      post "/api/v1/auth/password",
           params: { email: user.email, redirect_url: "http://localhost:3000/reset-password" }, as: :json

      expect(response).to have_http_status(:success)
    end

    it "よそのホストへは飛ばせない" do
      post "/api/v1/auth/password",
           params: { email: user.email, redirect_url: "https://example.com/reset-password" }, as: :json

      expect(response).not_to have_http_status(:success)
    end

    # ここが `/` を落としたときに開く穴。前方一致だけだと
    # `localhost:3000.example.com` が「localhost:3000 で始まる」ので通ってしまう
    it "自分たちのホスト名で始まる別ホストへも飛ばせない" do
      post "/api/v1/auth/password",
           params: { email: user.email, redirect_url: "http://localhost:3000.example.com/reset-password" },
           as: :json

      expect(response).not_to have_http_status(:success)
    end

    it "許可していない画面へは飛ばせない" do
      post "/api/v1/auth/password",
           params: { email: user.email, redirect_url: "http://localhost:3000/admin" }, as: :json

      expect(response).not_to have_http_status(:success)
    end
  end

  # **実際にトークンが載る経路。** メールのリンクを踏んだ先で、
  # gem は `reset_password_token` をクエリに付けて redirect_url へ飛ばす。
  # 合鍵が本物かどうかより先に、戻り先の検査で止まる
  describe "メールのリンクの着地点（GET /api/v1/auth/password/edit）" do
    # **本物の合鍵を使う。** ダミーだと許可リストを見る前に「合鍵が違う」で 404 になり、
    # 何も検査していないのに通ってしまう
    let(:token) do
      raw, encoded = Devise.token_generator.generate(User, :reset_password_token)
      user.update!(reset_password_token: encoded, reset_password_sent_at: Time.current)
      raw
    end

    it "自分たちのフロントへは、合鍵を付けて飛ばす" do
      get "/api/v1/auth/password/edit",
          params: { reset_password_token: token, redirect_url: "http://localhost:3000/reset-password" }

      expect(response).to have_http_status(:redirect)
      expect(response.headers["Location"]).to start_with("http://localhost:3000/reset-password#")
      expect(response.headers["Location"]).to include("access-token=")
    end

    # 合鍵は `#` の側にだけ置く。`?` に置くと、
    # **Rails のログ・ブラウザの履歴・Referer に残る**
    it "合鍵をクエリ文字列に載せない" do
      get "/api/v1/auth/password/edit",
          params: { reset_password_token: token, redirect_url: "http://localhost:3000/reset-password" }

      query = URI.parse(response.headers["Location"]).query
      expect(query).to be_blank, "クエリに #{query} が載っている"
    end

    it "一度だけパスワードを変えられる状態になる" do
      get "/api/v1/auth/password/edit",
          params: { reset_password_token: token, redirect_url: "http://localhost:3000/reset-password" }

      expect(user.reload.allow_password_change).to be(true)
    end

    it "期限切れ・でたらめな合鍵では飛ばさない" do
      get "/api/v1/auth/password/edit",
          params: { reset_password_token: "でたらめ", redirect_url: "http://localhost:3000/reset-password" }

      expect(response).not_to have_http_status(:redirect)
    end

    # ここを塞げていないと、合鍵がまるごとよそへ渡る
    it "よそのホストへは飛ばさない" do
      get "/api/v1/auth/password/edit",
          params: { reset_password_token: token, redirect_url: "https://example.com/steal" }

      expect(response.headers["Location"].to_s).not_to include("example.com")
      expect(response.body).not_to include(token)
    end
  end

  describe "新規登録（POST /api/v1/auth）" do
    def signup(extra = {})
      post "/api/v1/auth", params: {
        email: "wl-#{SecureRandom.hex(4)}@example.com",
        password: "password123",
        password_confirmation: "password123"
      }.merge(extra), as: :json
    end

    # 既定の戻り先は FRONTEND_URL + `/login`。**許可リストから `/login` を外すと
    # 新規登録が丸ごと落ちる**ので、その回帰をここで止める
    it "戻り先を省いた登録は通る（既定の /login が許可されている）" do
      signup

      expect(response).to have_http_status(:success)
      expect(response.headers["access-token"]).to be_present
    end

    it "よその戻り先を指定した登録は通らない" do
      signup(confirm_success_url: "https://example.com/login")

      expect(response).not_to have_http_status(:success)
      expect(User.where("email LIKE ?", "wl-%")).to be_empty
    end
  end

  describe "許可リストの組み立て" do
    it "オリジンごとに、使う画面だけを許している" do
      expect(DeviseTokenAuth.redirect_whitelist).to include(
        "http://localhost:3000/reset-password*",
        "http://localhost:3000/login*"
      )
    end

    # 空にすると gem は「どれにも一致しない」と見なし、登録も再設定も落ちる
    it "空にはならない" do
      expect(DeviseTokenAuth.redirect_whitelist).not_to be_empty
    end
  end
end
