require "rails_helper"

# 読みものの見出し画像。運営が差し替え・取り外しする。
RSpec.describe "読みものの見出し画像", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:admin_headers) { auth_headers_for(admin) }

  let(:post_record) do
    Post.create!(slug: "hello", category: "news", title: "こんにちは",
                 body: [ { "type" => "p", "text" => "本文" } ], published_at: 1.hour.ago)
  end

  # 1×1 の PNG。libvips に渡る前の allowlist（マジックバイト）を通る最小のもの
  def png_upload
    data = Base64.decode64(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    Rack::Test::UploadedFile.new(StringIO.new(data), "image/png", original_filename: "a.png")
  end

  def text_upload
    Rack::Test::UploadedFile.new(StringIO.new("これは画像ではない"), "image/png", original_filename: "a.png")
  end

  describe "POST /api/v1/admin/posts/:id/cover" do
    it "画像を差し替え、監査ログに残す" do
      expect {
        post "/api/v1/admin/posts/#{post_record.id}/cover",
          params: { file: png_upload }, headers: admin_headers
      }.to change { AdminAuditLog.where(action: "post.cover_updated").count }.by(1)

      expect(response).to have_http_status(:ok)
      expect(post_record.reload.cover_image).to be_attached
      # 何を渡されても、保存されるのは WebP だけ（自己申告の Content-Type を信じない）
      expect(post_record.cover_image.blob.content_type).to eq("image/webp")
      expect(response.parsed_body["image_url"]).to be_present
    end

    it "画像として読めないものは断る" do
      post "/api/v1/admin/posts/#{post_record.id}/cover",
        params: { file: text_upload }, headers: admin_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(post_record.reload.cover_image).not_to be_attached
    end

    it "ファイルが無ければ断る" do
      post "/api/v1/admin/posts/#{post_record.id}/cover", headers: admin_headers

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "運営でなければ差し替えられない" do
      post "/api/v1/admin/posts/#{post_record.id}/cover",
        params: { file: png_upload }, headers: headers

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /api/v1/admin/posts/:id/cover" do
    it "取り外して、監査ログに残す" do
      post "/api/v1/admin/posts/#{post_record.id}/cover",
        params: { file: png_upload }, headers: admin_headers

      expect {
        delete "/api/v1/admin/posts/#{post_record.id}/cover", headers: admin_headers
      }.to change { AdminAuditLog.where(action: "post.cover_removed").count }.by(1)

      expect(post_record.reload.cover_image).not_to be_attached
    end
  end

  describe "読む側" do
    before do
      post "/api/v1/admin/posts/#{post_record.id}/cover",
        params: { file: png_upload }, headers: admin_headers
    end

    it "一覧にも記事にも画像を返す" do
      get "/api/v1/posts", headers: headers
      expect(response.parsed_body["posts"].first["image_url"]).to be_present

      get "/api/v1/posts/#{post_record.slug}", headers: headers
      expect(response.parsed_body["image_url"]).to be_present
    end

    it "「出さない」にすると、添付があっても返さない" do
      patch "/api/v1/admin/posts/#{post_record.id}",
        params: { post: { cover_visible: false } }, headers: admin_headers, as: :json

      get "/api/v1/posts/#{post_record.slug}", headers: headers

      expect(response.parsed_body["image_url"]).to be_nil
    end
  end
end
