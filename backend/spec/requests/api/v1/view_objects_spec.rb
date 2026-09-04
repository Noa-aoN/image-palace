require "rails_helper"

# 図形と線を、ひとまとめに重ねる。
#
# 種類ごとに分けて並べていた頃は、「線の上に付箋を置く」ができなかった。
RSpec.describe "Api::V1::Views objects の重なり順", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:view) { create(:view, user: user, view_type: "freeboard") }

  let(:sticky) { view.view_shapes.create!(kind: "sticky", x: 0, y: 0, width: 180, height: 180) }
  let(:rect) { view.view_shapes.create!(kind: "rectangle", x: 0, y: 0, width: 240, height: 160) }
  let(:edge) { view.view_edges.create!(source_node_id: "a", target_node_id: "b") }

  def reorder(ordered)
    patch "/api/v1/views/#{view.id}/objects/reorder", params: { ordered: ordered }, headers: headers, as: :json
  end

  it "図形と線に、ひとつの並びから番号を配る" do
    reorder([ { kind: "shape", id: sticky.id }, { kind: "edge", id: edge.id }, { kind: "shape", id: rect.id } ])

    expect(response).to have_http_status(:no_content)
    expect(sticky.reload.z_index).to be > edge.reload.z_index
    expect(edge.z_index).to be > rect.reload.z_index
  end

  it "付箋を線の下へも回せる" do
    reorder([ { kind: "edge", id: edge.id }, { kind: "shape", id: sticky.id } ])

    expect(edge.reload.z_index).to be > sticky.reload.z_index
  end

  it "知らない種類は捨てる（別の表を書き換えない）" do
    before_z = sticky.z_index

    reorder([ { kind: "card", id: sticky.id }, { kind: "shape", id: sticky.id } ])

    expect(response).to have_http_status(:no_content)
    expect(sticky.reload.z_index).not_to eq(before_z)
  end

  it "他人のボードは触れない" do
    other = create(:view, user: create(:user), view_type: "freeboard")

    patch "/api/v1/views/#{other.id}/objects/reorder",
          params: { ordered: [] }, headers: headers, as: :json

    expect(response).to have_http_status(:not_found)
  end

  it "ログインが要る" do
    patch "/api/v1/views/#{view.id}/objects/reorder", params: { ordered: [] }, as: :json

    expect(response).to have_http_status(:unauthorized)
  end

  it "空でも落ちない" do
    reorder([])

    expect(response).to have_http_status(:no_content)
  end
end
