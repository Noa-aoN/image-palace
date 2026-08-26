require "rails_helper"

# 使い続けている限り切れないセッションに、**絶対上限**を置く。
#
# ## テストの組み方
#
# トークン自身の寿命は7日だが、リクエストのたびに再発行される。
# だから「30日後に叩く」だけでは、**上限ではなくトークンの寿命で**切れてしまい、
# 上限が効いたのか確かめられない。
#
# 使い続けている様子（数日おきに叩き、返ってきた新しい印を使う）を作って確かめる。
RSpec.describe "セッションの絶対上限", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:start) { Time.zone.local(2026, 8, 1, 9, 0, 0) }

  # 叩いて、返ってきた新しい印を次に使う（実際の画面と同じ振る舞い）
  def keep_using(headers)
    get "/api/v1/items", headers: headers
    headers.merge(
      "access-token" => response.headers["access-token"].presence || headers["access-token"],
      "client" => response.headers["client"].presence || headers["client"]
    )
  end

  it "始まったばかりなら、いつもどおり通る" do
    travel_to(start) do
      get "/api/v1/items", headers: auth_headers_for(user)
      expect(response).to have_http_status(:ok)
    end
  end

  # デプロイした瞬間に全員が締め出される、を避ける
  it "記録の無い端末は、そこから数え始める（すぐには切らない）" do
    travel_to(start) do
      headers = auth_headers_for(user)
      expect(user.session_starts).to eq({})

      get "/api/v1/items", headers: headers

      expect(response).to have_http_status(:ok)
      expect(user.reload.session_starts[headers["client"]]).to be_present
    end
  end

  it "使い続けていても、上限を越えたら入り直してもらう" do
    headers = nil
    travel_to(start) { headers = keep_using(auth_headers_for(user)) }

    # 3日おきに使い続ける。トークンはそのたびに延びる
    (1..10).each do |n|
      travel_to(start + (n * 3).days) do
        headers = keep_using(headers)
        expect(response).to have_http_status(:ok), "#{n * 3}日目で切れた（上限は#{SessionLifetime.max_days}日）"
      end
    end

    # 33日目。使い続けているのに、ここで打ち切る
    travel_to(start + 33.days) do
      get "/api/v1/items", headers: headers

      expect(response).to have_http_status(:unauthorized)
      expect(json_response["reason"]).to eq("session_expired")
    end
  end

  it "締め出したあとは、その端末の印を残さない" do
    headers = nil
    travel_to(start) { headers = keep_using(auth_headers_for(user)) }
    (1..10).each { |n| travel_to(start + (n * 3).days) { headers = keep_using(headers) } }

    travel_to(start + 33.days) do
      get "/api/v1/items", headers: headers
      expect(response).to have_http_status(:unauthorized)
    end

    expect(user.reload.tokens).not_to have_key(headers["client"])
  end

  # デプロイせずに切れるようにしておく
  it "止めていれば、使い続けている限り通る" do
    headers = nil
    travel_to(start) { headers = keep_using(auth_headers_for(user)) }
    allow(SessionLifetime).to receive(:max_days).and_return(0)

    (1..20).each { |n| travel_to(start + (n * 3).days) { headers = keep_using(headers) } }

    travel_to(start + 63.days) do
      get "/api/v1/items", headers: headers
      expect(response).to have_http_status(:ok)
    end
  end
end
