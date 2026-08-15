require "rails_helper"

# そのカードで、これまでに使った絵。
#
# **絵そのものは増やさない。** 生成した絵は shared_medias に残っている
# （消えないし、強制の作り直しも別の行として積まれる）。
# 失われていたのは「いつ、どれを使ったか」の結びつきだけだった。
RSpec.describe "使った絵の履歴", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, :completed, user: user, item_type: item_type, title: "光合成") }

  def shared_media!(prompt:, model: "gpt-image-1")
    shared = SharedMedia.create!(
      normalized_prompt: prompt,
      metadata: { "model" => model, "quality" => "medium" }
    )
    shared.file.attach(
      io: StringIO.new("dummy"), filename: "#{prompt}.webp", content_type: "image/webp"
    )
    shared
  end

  def record!(shared, used_at: Time.current)
    ItemMediaGeneration.record!(item: item, shared_media: shared, prompt: shared.normalized_prompt,
                                model: shared.metadata["model"], now: used_at)
  end

  describe "一覧" do
    it "新しく使ったものが上に並ぶ" do
      record!(shared_media!(prompt: "古い絵"), used_at: 3.days.ago)
      record!(shared_media!(prompt: "新しい絵"), used_at: 1.hour.ago)

      get "/api/v1/items/#{item.id}/media_generations", headers: headers

      expect(json_response["generations"].map { |row| row["prompt"] }).to eq([ "新しい絵", "古い絵" ])
    end

    it "同じ絵に戻しても行は増えない（一覧が同じ絵で埋まらない）" do
      shared = shared_media!(prompt: "同じ絵")
      record!(shared, used_at: 2.days.ago)

      expect { record!(shared, used_at: Time.current) }.not_to change(ItemMediaGeneration, :count)

      get "/api/v1/items/#{item.id}/media_generations", headers: headers
      expect(json_response["generations"].size).to eq(1)
    end

    it "モデルと指示が分かる（なぜこの絵になったかを辿れる）" do
      record!(shared_media!(prompt: "光合成の絵", model: "fal-ai/flux/schnell"))

      get "/api/v1/items/#{item.id}/media_generations", headers: headers

      row = json_response["generations"].first
      expect(row["model"]).to eq("fal-ai/flux/schnell")
      expect(row["prompt"]).to eq("光合成の絵")
      expect(row["url"]).to be_present
    end

    it "ほかの人のカードは覗けない" do
      other = create(:user, :confirmed)

      get "/api/v1/items/#{item.id}/media_generations", headers: auth_headers_for(other)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "戻す" do
    it "生成せずに付け替える（クレジットは減らない）" do
      shared = shared_media!(prompt: "前の絵")
      row = record!(shared)

      expect {
        post "/api/v1/items/#{item.id}/media_generations/#{row.id}/apply", headers: headers
      }.not_to change { user.reload.available_credit_points }

      expect(response).to have_http_status(:ok)
      expect(item.reload.primary_media.metadata["model"]).to eq("gpt-image-1")
    end

    it "いま使っている絵には印が付く" do
      shared = shared_media!(prompt: "いまの絵")
      row = record!(shared)
      post "/api/v1/items/#{item.id}/media_generations/#{row.id}/apply", headers: headers

      get "/api/v1/items/#{item.id}/media_generations", headers: headers

      expect(json_response["generations"].first["current"]).to be(true)
    end

    it "戻したぶんも記録に残る（時刻が新しくなる）" do
      shared = shared_media!(prompt: "前の絵")
      row = record!(shared, used_at: 3.days.ago)

      post "/api/v1/items/#{item.id}/media_generations/#{row.id}/apply", headers: headers

      expect(row.reload.used_at).to be_within(1.minute).of(Time.current)
    end
  end

  # **見出し語を変えたら、前の語で作った絵は選べない。**
  # 残しておくと、1枚のカードで語を書き換えながら絵を集め、
  # あとから好きなものを選び直せてしまう（語と絵の結びつきが崩れる）
  describe "見出し語を変えたあと" do
    it "前の語で作った絵は一覧に出ない" do
      record!(shared_media!(prompt: "前の語の絵"))

      item.update!(title: "別の語")
      get "/api/v1/items/#{item.id}/media_generations", headers: headers

      expect(json_response["generations"]).to be_empty
    end

    it "前の語で作った絵は、直に叩いても付け替えられない" do
      row = record!(shared_media!(prompt: "前の語の絵"))
      item.update!(title: "別の語")

      post "/api/v1/items/#{item.id}/media_generations/#{row.id}/apply", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "新しい語で作ったものは、これまでどおり選べる" do
      item.update!(title: "別の語")
      row = record!(shared_media!(prompt: "新しい語の絵"))

      get "/api/v1/items/#{item.id}/media_generations", headers: headers
      expect(json_response["generations"].size).to eq(1)

      post "/api/v1/items/#{item.id}/media_generations/#{row.id}/apply", headers: headers
      expect(response).to have_http_status(:ok)
    end

    # 後から入れた決まりで、過去に作った絵を取り上げない
    it "語を記録していない古い行は、これまでどおり選べる" do
      row = record!(shared_media!(prompt: "昔の絵"))
      row.update_columns(item_title: nil)

      get "/api/v1/items/#{item.id}/media_generations", headers: headers

      expect(json_response["generations"].size).to eq(1)
    end
  end

  describe "記録を消す" do
    it "記録だけ消える。**絵は消さない**（同じ絵をほかの人が使っている）" do
      shared = shared_media!(prompt: "共有の絵")
      row = record!(shared)

      expect {
        delete "/api/v1/items/#{item.id}/media_generations/#{row.id}", headers: headers
      }.to change(ItemMediaGeneration, :count).by(-1)

      expect(response).to have_http_status(:no_content)
      expect(SharedMedia.exists?(shared.id)).to be(true)
      expect(shared.reload.file).to be_attached
    end

    it "ほかの人の記録は消せない" do
      other = create(:user, :confirmed)
      row = record!(shared_media!(prompt: "絵"))

      delete "/api/v1/items/#{item.id}/media_generations/#{row.id}", headers: auth_headers_for(other)

      expect(response).to have_http_status(:not_found)
      expect(ItemMediaGeneration.exists?(row.id)).to be(true)
    end
  end
end
