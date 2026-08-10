require "rails_helper"

# 読みものの一覧で「状態」と「読まれた回数」を見られるようにしたぶん。
RSpec.describe "読みものの状態と閲覧数", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:admin) { create(:user, :confirmed, role: "owner") }
  let(:admin_headers) { auth_headers_for(admin) }

  def make_post(**attrs)
    Post.create!({ slug: "hello", title: "こんにちは", category: "news",
                   body: [ { "type" => "p", "text" => "本文" } ] }.merge(attrs))
  end

  it "公開ページを開くと読まれた回数が増える" do
    post_record = make_post(published_at: 1.day.ago)

    expect {
      get "/api/v1/posts/#{post_record.slug}", headers: headers
    }.to change { post_record.reload.views_count }.by(1)
  end

  it "下書きは公開側から読めない（数も増えない）" do
    post_record = make_post

    get "/api/v1/posts/#{post_record.slug}", headers: headers

    expect(response).to have_http_status(:not_found)
    expect(post_record.reload.views_count).to eq(0)
  end

  describe "運営の一覧" do
    # published だけだと、公開予定のものが下書きに見える
    it "下書き・予約・公開を区別して返す" do
      make_post(slug: "draft-one", published_at: nil)
      make_post(slug: "scheduled-one", published_at: 3.days.from_now)
      make_post(slug: "published-one", published_at: 1.day.ago)

      get "/api/v1/admin/posts", headers: admin_headers

      by_slug = response.parsed_body["posts"].to_h { |p| [ p["slug"], p["status"] ] }
      expect(by_slug["draft-one"]).to eq("draft")
      expect(by_slug["scheduled-one"]).to eq("scheduled")
      expect(by_slug["published-one"]).to eq("published")
    end

    it "読まれた回数を返す" do
      make_post(published_at: 1.day.ago, views_count: 12)

      get "/api/v1/admin/posts", headers: admin_headers

      expect(response.parsed_body["posts"].first["views_count"]).to eq(12)
    end

    # 編集は個別ページで行うので、1本だけ読めることが要る
    it "1本だけ読める" do
      post_record = make_post

      get "/api/v1/admin/posts/#{post_record.id}", headers: admin_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["slug"]).to eq("hello")
    end

    it "運営でなければ触れない" do
      post_record = make_post

      get "/api/v1/admin/posts/#{post_record.id}", headers: headers

      expect(response).to have_http_status(:forbidden)
    end
  end
end
