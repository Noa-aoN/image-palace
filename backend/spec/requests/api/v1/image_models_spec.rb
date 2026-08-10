require "rails_helper"

# カードごとに絵のモデルを選べるようにしたぶん。
RSpec.describe "画像モデルの選択", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  def with_env(values)
    original = values.keys.index_with { |k| ENV[k] }
    values.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
    yield
  ensure
    original.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end

  describe "GET /api/v1/image_models" do
    # 選んだ瞬間に失敗するものを並べても仕方がない
    it "鍵の入っているものだけ返す" do
      with_env("OPENAI_API_KEY" => "x", "FAL_API_KEY" => nil) do
        get "/api/v1/image_models", headers: headers

        expect(response.parsed_body["models"].map { |m| m["key"] }).to eq([ "openai" ])
      end
    end

    it "鍵を足すと選べるようになる（デプロイは要らない）" do
      with_env("OPENAI_API_KEY" => "x", "FAL_API_KEY" => "y") do
        get "/api/v1/image_models", headers: headers

        expect(response.parsed_body["models"].map { |m| m["key"] }).to contain_exactly("openai", "flux")
      end
    end

    it "認証が要る" do
      get "/api/v1/image_models"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "カードの指定" do
    # 鍵を1つ外しただけで過去のカードが編集できなくなるのは困る
    it "選べないモデルを指定されたら、おまかせに丸める" do
      with_env("OPENAI_API_KEY" => "x", "FAL_API_KEY" => nil) do
        item = create(:item, user: user, image_model: "flux")

        expect(item.image_model).to be_nil
      end
    end

    it "選べるモデルはそのまま残る" do
      with_env("OPENAI_API_KEY" => "x", "FAL_API_KEY" => "y") do
        item = create(:item, user: user, image_model: "flux")

        expect(item.reload.image_model).to eq("flux")
      end
    end
  end

  describe "キャッシュの分かれ方" do
    # 同じ言葉でもモデルが違えば別の絵。混ざると、選んだ意味が無くなる
    it "モデルが違えばキャッシュのキーも変わる" do
      with_env("OPENAI_API_KEY" => "x", "FAL_API_KEY" => "y") do
        default_key = GenerateImageService.namespaced_cache_key("ねこ")
        flux_key = GenerateImageService.namespaced_cache_key("ねこ", model_key: "flux")

        expect(flux_key).not_to eq(default_key)
      end
    end

    # 既存のキャッシュを外さないための後方互換
    it "既定（openai/gpt-image-1）のキーは素のまま" do
      with_env("OPENAI_API_KEY" => "x", "FAL_API_KEY" => nil) do
        expect(GenerateImageService.namespaced_cache_key("ねこ", model_key: "openai")).to eq("ねこ")
      end
    end
  end
end
