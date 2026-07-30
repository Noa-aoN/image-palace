require "rails_helper"

RSpec.describe "CORS", type: :request do
  let(:origin) { "http://localhost:3000" }

  it "API に許可オリジンのヘッダーを返す" do
    get "/api/v1/health", headers: { "HTTP_ORIGIN" => origin }

    expect(response.headers["Access-Control-Allow-Origin"]).to eq(origin)
  end

  # 3D ビューは画像を WebGL テクスチャとして読むため、画像配信にも CORS が要る。
  # ヘッダーが無いと 2D は平気なのに 3D だけ画像が出ない、という分かりにくい壊れ方をする。
  it "画像配信（Active Storage）にも許可オリジンのヘッダーを返す" do
    get "/rails/active_storage/blobs/proxy/dummy/dummy.webp", headers: { "HTTP_ORIGIN" => origin }

    expect(response.headers["Access-Control-Allow-Origin"]).to eq(origin)
  end

  it "許可していないオリジンにはヘッダーを返さない" do
    get "/rails/active_storage/blobs/proxy/dummy/dummy.webp", headers: { "HTTP_ORIGIN" => "https://evil.example" }

    expect(response.headers["Access-Control-Allow-Origin"]).to be_nil
  end
end
