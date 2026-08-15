require "rails_helper"

# `/api/v1/admin/session` は**ログインしている全員**が通る。
# サイドバーに「執務室」を出すかどうかの判断に使うため、運営でない人も叩く。
#
# だから、ここに1本足すと全員が待つ。DB は隣の部屋には無い。
# 強い確認をまだ求めていない間は、その状態を調べる問い合わせも要らない
# （画面は required だけ見て、残りを読まない）。
RSpec.describe "運営セッションの問い合わせ本数", type: :request do
  let(:user) { create(:user, :confirmed, role: "admin") }
  let(:headers) { auth_headers_for(user) }



  it "求めていない間は、強い確認を調べに行かない" do
    allow(Auth::StrongAuth).to receive(:admin_required?).and_return(false)
    get "/api/v1/admin/session", headers: headers # 温める

    count = count_queries { get "/api/v1/admin/session", headers: headers }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["strong_auth"]).to eq("required" => false)
    expect(count).to eq(0)
  end

  # 求めているなら要る。そのときは払う価値がある
  it "求めているときだけ調べる" do
    allow(Auth::StrongAuth).to receive(:admin_required?).and_return(true)
    get "/api/v1/admin/session", headers: headers

    count = count_queries { get "/api/v1/admin/session", headers: headers }

    expect(response.parsed_body["strong_auth"]).to include("required" => true)
    expect(count).to be <= 2
  end

  # 強い確認は運営の話。運営でない人にとっては、求めていようがいまいが関係ない。
  # ここを見落とすと、栓を入にした日から**利用者全員**が2本ぶん待つ
  context "運営でない人" do
    let(:user) { create(:user, :confirmed) }

    it "求めていても調べに行かない" do
      allow(Auth::StrongAuth).to receive(:admin_required?).and_return(true)
      get "/api/v1/admin/session", headers: headers

      count = count_queries { get "/api/v1/admin/session", headers: headers }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["admin"]).to be(false)
      expect(response.parsed_body["strong_auth"]).to eq("required" => false)
      expect(count).to eq(0)
    end
  end
end
