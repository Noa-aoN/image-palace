require "rails_helper"

# カード一覧が「枚数に比例して問い合わせが増えない」ことを見張る。
#
# DB は隣の部屋には無い（本番は nrt から Neon まで片道 70ms）。
# 1枚ごとに1本増えるだけで、24枚の一覧が数秒遅くなる。実際、
# サムネイルの添付を読み忘れていたときは 82 本・約 5.6 秒かかっていた。
#
# 速さそのものは環境で変わるので測らない。**問い合わせの本数**だけを見る。
# 枚数を変えても本数が変わらなければ、N+1 は入っていない。
RSpec.describe "カード一覧の問い合わせ本数", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  def create_card(title)
    item = user.items.create!(title: title, item_type: item_type, generation_status: "completed")
    item.meanings.create!(definition: "#{title}の説明", language_code: "ja", position: 1)
    create(:media, :with_thumb, item: item)
    item
  end



  it "枚数を増やしても問い合わせの本数は増えない" do
    2.times { |i| create_card("語#{i}") }
    # 認証やユーザー設定の読み込みを先に済ませる（1回目だけ余分に走るため）
    get "/api/v1/items", headers: headers

    few = count_queries { get "/api/v1/items", headers: headers }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["items"].size).to eq(2)

    6.times { |i| create_card("追加#{i}") }
    many = count_queries { get "/api/v1/items", headers: headers }
    expect(response.parsed_body["items"].size).to eq(8)

    expect(many).to eq(few)
  end
end
