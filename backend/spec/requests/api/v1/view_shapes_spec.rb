require "rails_helper"

# ボードに置く図形。四角・丸・付箋・見出し・かこみ。
#
# 線（view_edges）と同じ形にしてある。カードの置き場所（view_items）は
# item_id が必須なので、図形はそこには入らない。
RSpec.describe "Api::V1::Views shapes", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:view) { user.views.create!(name: "板", view_type: "freeboard") }

  describe "置く" do
    it "図形を置ける" do
      post "/api/v1/views/#{view.id}/shapes",
           params: { kind: "rectangle", x: 100, y: 200 }, headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(json_response["kind"]).to eq("rectangle")
      expect(json_response["x"]).to eq(100)
    end

    # 置いてから毎回そろえ直すより、用途に合った形で置かれるほうが速い
    it "大きさを指定しなければ、種類に合った既定で置く" do
      post "/api/v1/views/#{view.id}/shapes", params: { kind: "sticky" }, headers: headers, as: :json

      defaults = ViewShape.default_size_for("sticky")
      expect(json_response["width"]).to eq(defaults[:width])
      expect(json_response["height"]).to eq(defaults[:height])
    end

    it "知らない種類は置けない" do
      post "/api/v1/views/#{view.id}/shapes", params: { kind: "星" }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "読めないほど小さくは置けない" do
      post "/api/v1/views/#{view.id}/shapes",
           params: { kind: "rectangle", width: 1, height: 1 }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 盤が図形で埋まると、カードが読めなくなる
    it "1つのボードに置ける数に上限がある" do
      limit = Api::V1::ViewShapesController::MAX_SHAPES
      limit.times { view.view_shapes.create!(kind: "rectangle") }

      post "/api/v1/views/#{view.id}/shapes", params: { kind: "rectangle" }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to include("#{limit}個まで")
    end
  end

  describe "見た目" do
    it "塗り・枠・文字の大きさを保存する" do
      post "/api/v1/views/#{view.id}/shapes",
           params: { kind: "sticky", style: { fill: "#ffe08a", stroke: "#333333",
                                              stroke_width: 2, font_size: 18 } },
           headers: headers, as: :json

      style = json_response["style"]
      expect(style["fill"]).to eq("#ffe08a")
      expect(style["stroke_width"]).to eq(2)
      expect(style["font_size"]).to eq(18)
    end

    # 式や関数をそのまま描画へ流さない
    it "色として扱えない指定は捨てる" do
      post "/api/v1/views/#{view.id}/shapes",
           params: { kind: "rectangle", style: { fill: "url(javascript:alert(1))" } },
           headers: headers, as: :json

      expect(json_response["style"]).not_to have_key("fill")
    end

    it "大きすぎる枠や文字は、扱える範囲へ収める" do
      post "/api/v1/views/#{view.id}/shapes",
           params: { kind: "rectangle", style: { stroke_width: 999, font_size: 999 } },
           headers: headers, as: :json

      style = json_response["style"]
      expect(style["stroke_width"]).to eq(Api::V1::ViewShapesController::MAX_STROKE_WIDTH)
      expect(style["font_size"]).to eq(Api::V1::ViewShapesController::MAX_FONT_SIZE)
    end

    it "知らない鍵は入れない" do
      post "/api/v1/views/#{view.id}/shapes",
           params: { kind: "rectangle", style: { onclick: "alert(1)" } },
           headers: headers, as: :json

      expect(json_response["style"]).not_to have_key("onclick")
    end
  end

  describe "直す" do
    let!(:shape) { view.view_shapes.create!(kind: "rectangle", style: { "fill" => "#ffffff" }) }

    it "置き場所と大きさを直せる" do
      patch "/api/v1/views/#{view.id}/shapes/#{shape.id}",
            params: { x: 300, y: 400, width: 500 }, headers: headers, as: :json

      shape.reload
      expect([ shape.x, shape.y, shape.width ]).to eq([ 300, 400, 500 ])
    end

    it "文字を入れられる" do
      patch "/api/v1/views/#{view.id}/shapes/#{shape.id}",
            params: { text: "ここは前半" }, headers: headers, as: :json

      expect(shape.reload.text).to eq("ここは前半")
    end

    # 一部だけ変えたいときに、他が消えないように
    it "見た目は足し合わせる（指定しなかったものは消えない）" do
      patch "/api/v1/views/#{view.id}/shapes/#{shape.id}",
            params: { style: { stroke: "#000000" } }, headers: headers, as: :json

      style = shape.reload.style
      expect(style["fill"]).to eq("#ffffff")
      expect(style["stroke"]).to eq("#000000")
    end

    it "種類は変えられない（別の図形として置き直す）" do
      patch "/api/v1/views/#{view.id}/shapes/#{shape.id}",
            params: { kind: "ellipse" }, headers: headers, as: :json

      expect(shape.reload.kind).to eq("rectangle")
    end
  end

  describe "消す" do
    it "図形を消せる" do
      shape = view.view_shapes.create!(kind: "rectangle")

      expect {
        delete "/api/v1/views/#{view.id}/shapes/#{shape.id}", headers: headers, as: :json
      }.to change(ViewShape, :count).by(-1)
    end

    it "ボードを消すと、図形も一緒に消える" do
      view.view_shapes.create!(kind: "rectangle")

      expect { view.destroy }.to change(ViewShape, :count).by(-1)
    end
  end

  describe "重なり順" do
    # かこみが前に出ると、中のカードが隠れる
    it "かこみは必ず後ろから返す" do
      view.view_shapes.create!(kind: "rectangle", z_index: 0)
      view.view_shapes.create!(kind: "frame", z_index: 99)

      get "/api/v1/views/#{view.id}", headers: headers, as: :json

      expect(json_response["shapes"].first["kind"]).to eq("frame")
    end

    it "手前から順に並べ替えられる" do
      first = view.view_shapes.create!(kind: "rectangle")
      second = view.view_shapes.create!(kind: "ellipse")

      patch "/api/v1/views/#{view.id}/shapes/reorder",
            params: { ordered_ids: [ second.id, first.id ] }, headers: headers, as: :json

      expect(second.reload.z_index).to be > first.reload.z_index
    end
  end

  describe "持ち主でなければ触れない" do
    it "他人のボードには置けない" do
      theirs = create(:user, :confirmed).views.create!(name: "他人", view_type: "freeboard")

      post "/api/v1/views/#{theirs.id}/shapes", params: { kind: "rectangle" }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "未ログインでは置けない" do
      post "/api/v1/views/#{view.id}/shapes", params: { kind: "rectangle" }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
