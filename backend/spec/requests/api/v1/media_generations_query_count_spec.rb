require "rails_helper"

# 使った絵の履歴が「枚数に比例して問い合わせが増えない」ことを見張る。
#
# 1行ごとに絵の実体を引きに行くと、そのまま本数になる。本番の DB は隣の部屋には無いので、
# 20枚ぶんの履歴を開くだけで待たされる。
#
# 速さは環境で変わるので測らない。**問い合わせの本数**だけを見る。
RSpec.describe "使った絵の履歴の問い合わせ本数", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }
  let(:item) { create(:item, :completed, user: user, item_type: item_type, title: "光合成") }

  # 認証まわりは数えない（トークンの更新で本数が揺れる）
  AUTH_TABLES = /"(users|settings)"/

  def count_queries
    count = 0
    sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      next if payload[:name].to_s.match?(/SCHEMA|TRANSACTION/)
      next if payload[:sql].to_s.match?(AUTH_TABLES)

      count += 1
    end
    yield
    count
  ensure
    ActiveSupport::Notifications.unsubscribe(sub)
  end

  def record_image!(index)
    shared = SharedMedia.create!(normalized_prompt: "絵#{index}", metadata: { "model" => "gpt-image-1" })
    shared.file.attach(io: StringIO.new("dummy"), filename: "#{index}.webp", content_type: "image/webp")
    # 一覧は縮小版を出す。**本体とは別の添付**なので、こちらの読み込み漏れが起きやすい
    shared.thumb.attach(io: StringIO.new("dummy"), filename: "#{index}-t.webp", content_type: "image/webp")
    ItemMediaGeneration.record!(item: item, shared_media: shared, prompt: shared.normalized_prompt,
                                model: "gpt-image-1", now: Time.current - index.hours)
  end

  it "履歴が増えても問い合わせの本数は増えない" do
    2.times { |i| record_image!(i) }
    get "/api/v1/items/#{item.id}/media_generations", headers: headers # 初回ぶんを温める

    few = count_queries { get "/api/v1/items/#{item.id}/media_generations", headers: headers }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["generations"].size).to eq(2)

    6.times { |i| record_image!(i + 2) }
    many = count_queries { get "/api/v1/items/#{item.id}/media_generations", headers: headers }
    expect(response.parsed_body["generations"].size).to eq(8)

    expect(many).to eq(few)
  end
end
