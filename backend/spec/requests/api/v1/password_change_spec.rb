require "rails_helper"

# パスワードの変更。
#
# **いまのパスワードを必ず聞く。** 聞かないと、トークンさえ奪えば
# パスワードごと乗っ取れてしまう（置き忘れた端末・持ち出されたトークンで、本人が締め出される）。
RSpec.describe "パスワードの変更", type: :request do
  let(:current_password) { "old-password-123" }
  let(:user) { create(:user, :confirmed, password: current_password, password_confirmation: current_password) }
  let(:headers) { auth_headers_for(user) }

  def change_password(params)
    put "/api/v1/auth", params: params, headers: headers, as: :json
  end

  it "いまのパスワードを添えれば変えられる" do
    change_password(
      current_password: current_password,
      password: "new-password-456",
      password_confirmation: "new-password-456"
    )

    expect(response).to have_http_status(:ok)
    expect(user.reload.valid_password?("new-password-456")).to be(true)
  end

  # ここが要。トークンだけでは変えられない
  it "いまのパスワードが無ければ断る" do
    change_password(password: "new-password-456", password_confirmation: "new-password-456")

    expect(response).not_to have_http_status(:ok)
    expect(user.reload.valid_password?(current_password)).to be(true)
  end

  it "いまのパスワードが違えば断る" do
    change_password(
      current_password: "wrong-password",
      password: "new-password-456",
      password_confirmation: "new-password-456"
    )

    expect(response).not_to have_http_status(:ok)
    expect(user.reload.valid_password?(current_password)).to be(true)
  end

  it "確認用と食い違えば断る" do
    change_password(
      current_password: current_password,
      password: "new-password-456",
      password_confirmation: "different-456"
    )

    expect(response).not_to have_http_status(:ok)
    expect(user.reload.valid_password?(current_password)).to be(true)
  end

  # devise-token-auth は未ログインのとき 404 を返す（誰の話かを明かさない）。
  # 変わらないことが要で、番号そのものは重要ではない
  it "未ログインでは変えられない" do
    user # 先に作っておく（let は参照するまで作られない）

    put "/api/v1/auth",
      params: { current_password: current_password, password: "new-password-456" },
      as: :json

    expect(response).not_to have_http_status(:ok)
    expect(user.reload.valid_password?(current_password)).to be(true)
  end

  # メールアドレスの変更は、Confirmable のレース（GHSA-57hq-95w6-v4fc）の
  # 攻撃面になるため、この経路では塞いである（#80 で別途設計する）
  it "メールアドレスは変えられない" do
    change_password(email: "changed@example.com")

    expect(response).to have_http_status(:unprocessable_content)
    expect(user.reload.email).not_to eq("changed@example.com")
  end
end
