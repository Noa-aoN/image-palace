require "rails_helper"

# 経営の画面が「利用者やカードの数に比例して問い合わせが増えない」ことを見張る。
#
# ここは1画面で20以上の数字を出す。1つずつ数え直すと本数が積み上がるし、
# 利用者ごとに1本増える形にすると、増えたときにいちばん重い画面になる。
#
# 速さそのものは環境で変わるので測らない。**問い合わせの本数**だけを見る。
RSpec.describe "経営の数字の問い合わせ本数", type: :request do
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:headers) { auth_headers_for(admin) }

  # 執務室の門（強い確認）を通っておく。通っていないと 403 で数字まで届かない
  before { StrongAuthSession.record!(user: admin, client_id: headers["client"], method: "passkey") }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  # 認証まわりは数えない（devise-token-auth はトークンを一定の窓でまとめて更新するため、
  # 同じ操作でも users への問い合わせが増えたり減ったりする）


  def seed(users:)
    users.times do |i|
      user = create(:user, :confirmed, last_seen_at: 1.hour.ago)
      user.items.create!(title: "語#{i}", item_type: item_type)
      user.grant_credits!(100, kind: "campaign", expires_at: 1.month.from_now)
    end
  end

  def fetch
    get "/api/v1/admin/business", headers: headers
  end

  it "利用者が増えても問い合わせの本数は増えない" do
    seed(users: 1)
    fetch # 認証まわりを先に済ませる（1回目だけ余分に走る）
    expect(response).to have_http_status(:ok)

    few = count_queries { fetch }

    seed(users: 4)
    many = count_queries { fetch }

    expect(many).to eq(few)
  end

  it "指標を足しても、まとめて数える形を崩さない" do
    seed(users: 1)
    fetch

    total = count_queries { fetch }

    # 現在と前期間の2つぶんを数えるが、収支の計算は同じ結果を使い回す。
    # クレジット経済も、種類ごとの合計を1回ずつ引くだけ（利用者ごとには引かない）。
    # いまは50本。ここが跳ねたら、どこかで1件ずつ数えている
    expect(total).to be <= 54
  end
end
