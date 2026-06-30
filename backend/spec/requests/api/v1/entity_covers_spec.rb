require "rails_helper"

# コレクション/ビュー/スペースのカバー（ヘッダー）設定（デッキ踏襲）
RSpec.describe "Api::V1 entity covers", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }
  let(:item) { create(:item, user: user, item_type: item_type, title: "りんご") }

  describe "コレクション" do
    let(:collection) { user.collections.create!(name: "英単語") }

    it "cover_type を更新でき、シリアライズに cover 各種を含む" do
      patch "/api/v1/collections/#{collection.id}",
        params: { collection: { cover_type: "collage" } }, headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response["cover_type"]).to eq("collage")
      expect(json_response).to have_key("cover_images")
      expect(json_response).to have_key("cover_image")
    end

    it "コレクション内のカードのみ表紙に指定できる" do
      collection.collection_entries.create!(entry_type: "Item", entry_id: item.id)
      patch "/api/v1/collections/#{collection.id}",
        params: { collection: { cover_item_id: item.id } }, headers: headers, as: :json
      expect(response).to have_http_status(:ok)
      expect(json_response["cover_item_id"]).to eq(item.id)

      outsider = create(:item, user: user, item_type: item_type, title: "外部")
      patch "/api/v1/collections/#{collection.id}",
        params: { collection: { cover_item_id: outsider.id } }, headers: headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "カバー画像を削除すると first_card に戻る" do
      collection.update!(cover_type: "custom")
      delete "/api/v1/collections/#{collection.id}/cover_image", headers: headers, as: :json
      expect(response).to have_http_status(:ok)
      expect(json_response["cover_type"]).to eq("first_card")
    end

    it "アップロードしたカバーを最適化(WebP)し、サムネも生成する" do
      skip "libvips 未インストール環境のためスキップ" unless vips_available?

      png = Tempfile.new([ "cover", ".png" ], binmode: true)
      png.write(Vips::Image.black(1600, 1200).pngsave_buffer)
      png.rewind

      post "/api/v1/collections/#{collection.id}/cover_image",
        params: { cover_image: Rack::Test::UploadedFile.new(png.path, "image/png") }, headers: headers

      expect(response).to have_http_status(:ok)
      collection.reload
      expect(collection.cover_image.blob.content_type).to eq("image/webp")
      expect(collection.cover_thumb).to be_attached
      expect(collection.cover_type).to eq("custom")
    ensure
      png&.close!
    end

    it "画像でないファイルは 422 で弾く" do
      txt = Tempfile.new([ "x", ".txt" ])
      txt.write("not an image")
      txt.rewind

      post "/api/v1/collections/#{collection.id}/cover_image",
        params: { cover_image: Rack::Test::UploadedFile.new(txt.path, "text/plain") }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    ensure
      txt&.close!
    end
  end

  describe "ビュー" do
    let(:view) { create(:view, user: user, view_type: "freeboard") }

    it "配置したカードのみ表紙に指定できる" do
      view.view_items.create!(item: item, x: 0, y: 0, z_index: 0)
      patch "/api/v1/views/#{view.id}",
        params: { view: { cover_item_id: item.id } }, headers: headers, as: :json
      expect(response).to have_http_status(:ok)
      expect(json_response["cover_item_id"]).to eq(item.id)

      outsider = create(:item, user: user, item_type: item_type, title: "未配置")
      patch "/api/v1/views/#{view.id}",
        params: { view: { cover_item_id: outsider.id } }, headers: headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "スペース" do
    let(:space) { create(:space, :road, user: user) }

    it "自スペースのポイントのみ表紙に指定でき、cover_images を返す" do
      point = create(:space_point, space: space, position: 1, name: "玄関")
      patch "/api/v1/spaces/#{space.id}",
        params: { space: { cover_space_point_id: point.id } }, headers: headers, as: :json
      expect(response).to have_http_status(:ok)
      expect(json_response["cover_space_point_id"]).to eq(point.id)
      expect(json_response).to have_key("cover_images")

      foreign = create(:space_point, space: create(:space, :road, user: user), position: 1)
      patch "/api/v1/spaces/#{space.id}",
        params: { space: { cover_space_point_id: foreign.id } }, headers: headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
