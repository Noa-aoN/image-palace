# frozen_string_literal: true

require "rails_helper"

# 工房室のカード一覧が「枚数に比例して問い合わせが増えない」ことを見張る。
#
# 1枚ごとに種別・意味・箱・キャンバス・絵を見に行く形にすると、
# 公式宮殿が育つほど重くなる。本番の DB は隣の部屋には無いので
# （Fly sin ↔ Neon）、本数がそのまま待ち時間になる。
#
# 荷物の中身も 1枚ずつ探すと荷物の数だけ引くことになるので、
# 先に対応表を作っている。**そこが崩れたらここで落ちる**
RSpec.describe "工房室のカード一覧の問い合わせ本数", type: :request do
  let(:studio_user) { create(:user, :confirmed, role: "admin") }
  let(:headers) { studio_user.create_new_auth_token }
  let(:official) { create(:user, :confirmed, email: "studio@example.com") }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  around do |example|
    original = ENV["OFFICIAL_CONTENT_USER_ID"]
    ENV["OFFICIAL_CONTENT_USER_ID"] = official.id
    example.run
    ENV["OFFICIAL_CONTENT_USER_ID"] = original
  end

  let!(:box) { official.boxes.create!(name: "ことば") }
  let!(:view) { official.views.create!(name: "並べたもの", view_type: "freeboard") }

  def seed(count)
    count.times do |i|
      item = official.items.create!(title: "語#{SecureRandom.hex(3)}", item_type: word,
                                    generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png",
                       content_type: "image/png")
      item.meanings.create!(definition: "説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: i + 1)
      view.view_items.create!(item: item, x: i * 10, y: 0, position: i)
    end
  end

  def fetch
    get "/api/v1/admin/studio/items", headers: headers, as: :json
  end

  it "カードが増えても問い合わせの本数は増えない" do
    seed(2)
    fetch # 認証まわりを先に済ませる（1回目だけ余分に走る）
    expect(response).to have_http_status(:ok)

    few = count_queries { fetch }

    seed(8)
    many = count_queries { fetch }

    expect(json_response["items"].size).to eq(10)
    expect(many).to eq(few)
  end

  # 荷物の中身は `origin_key` で繋がっている。
  # 1枚ずつ探すと荷物の数だけ引くことになる
  it "荷物が増えても問い合わせの本数は増えない" do
    seed(3)
    fetch
    one = count_queries { fetch }

    3.times do |i|
      ContentPackage.publish!(key: "starter_#{i}", kind: "starter", name: "荷物#{i}",
                              payload: ContentPackages::Exporter.call(boxes: [ box.reload ]))
    end

    expect(count_queries { fetch }).to be <= one + 1
  end
end
