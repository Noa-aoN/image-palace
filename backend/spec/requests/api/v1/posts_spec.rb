require "rails_helper"

RSpec.describe "運営からの読みもの", type: :request do
  let(:member) { create(:user, :confirmed) }
  let(:member_headers) { auth_headers_for(member) }
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:admin_headers) { auth_headers_for(admin) }

  def create_post(attrs = {})
    Post.create!({
      slug: "hello", category: "news", title: "こんにちは",
      body: [ { "type" => "p", "text" => "本文" } ], published_at: Time.current
    }.merge(attrs))
  end

  describe "読む側" do
    it "公開済みだけ返す" do
      create_post(slug: "open", title: "公開")
      create_post(slug: "draft", title: "下書き", published_at: nil)

      get "/api/v1/posts", headers: member_headers

      expect(json_response["posts"].map { |p| p["slug"] }).to eq([ "open" ])
    end

    it "公開日時が未来のものはまだ返さない" do
      create_post(slug: "later", published_at: 1.day.from_now)

      get "/api/v1/posts", headers: member_headers

      expect(json_response["posts"]).to eq([])
    end

    it "種類で絞り込める" do
      create_post(slug: "news-1", category: "news")
      create_post(slug: "column-1", category: "column")

      get "/api/v1/posts", params: { category: "column" }, headers: member_headers

      expect(json_response["posts"].map { |p| p["slug"] }).to eq([ "column-1" ])
    end

    it "留めたものを先頭に出す" do
      create_post(slug: "new", published_at: 1.hour.ago)
      create_post(slug: "pinned", pinned: true, published_at: 1.day.ago)

      get "/api/v1/posts", headers: member_headers

      expect(json_response["posts"].first["slug"]).to eq("pinned")
    end

    it "一覧には本文を含めない（詳細でだけ返す）" do
      create_post

      get "/api/v1/posts", headers: member_headers
      expect(json_response["posts"].first).not_to have_key("body")

      get "/api/v1/posts/hello", headers: member_headers
      expect(json_response["body"].first["text"]).to eq("本文")
    end

    it "下書きは詳細でも読めない" do
      create_post(slug: "draft", published_at: nil)

      get "/api/v1/posts/draft", headers: member_headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "書く側" do
    it "一般ユーザーは書けない" do
      post "/api/v1/admin/posts",
           params: { post: { slug: "x", title: "t", body_text: "本文" } }, headers: member_headers, as: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "平文から本文の塊を組み立てる" do
      text = "はじめの段落\n\n## 見出し\n\n- ひとつ\n- ふたつ\n\n> 引用です"

      post "/api/v1/admin/posts",
           params: { post: { slug: "guide", category: "column", title: "書き方", body_text: text } },
           headers: admin_headers, as: :json

      expect(response).to have_http_status(:created)
      body = Post.find_by(slug: "guide").body
      expect(body.map { |b| b["type"] }).to eq(%w[p h2 ul quote])
      expect(body[2]["items"]).to eq(%w[ひとつ ふたつ])
    end

    it "作った記録が残る" do
      expect {
        post "/api/v1/admin/posts",
             params: { post: { slug: "n", title: "t", body_text: "本文" } }, headers: admin_headers, as: :json
      }.to change(AdminAuditLog, :count).by(1)

      expect(AdminAuditLog.last.action).to eq("post.created")
    end

    it "扱えない slug は受け付けない" do
      post "/api/v1/admin/posts",
           params: { post: { slug: "日本語 スラッグ", title: "t", body_text: "本文" } },
           headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "同じ slug は作れない" do
      create_post(slug: "dup")

      post "/api/v1/admin/posts",
           params: { post: { slug: "dup", title: "t", body_text: "本文" } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "公開の切り替えができ、戻すと読めなくなる" do
      target = create_post(slug: "toggle", published_at: nil)

      patch "/api/v1/admin/posts/#{target.id}",
            params: { post: { published: true } }, headers: admin_headers, as: :json
      expect(target.reload.published?).to be(true)

      patch "/api/v1/admin/posts/#{target.id}",
            params: { post: { published: false } }, headers: admin_headers, as: :json
      expect(target.reload.published?).to be(false)
    end

    it "編集画面へ戻すための平文を返す" do
      target = create_post(slug: "roundtrip")
      text = "段落\n\n## 見出し\n\n- ひとつ"

      patch "/api/v1/admin/posts/#{target.id}",
            params: { post: { body_text: text } }, headers: admin_headers, as: :json

      expect(json_response["body_text"]).to eq(text)
    end
  end

  describe "配信" do
    let!(:reader) { create(:user, :confirmed) }

    it "公開済みなら全員へお知らせを積む" do
      target = create_post(slug: "release", title: "新機能")

      expect {
        post "/api/v1/admin/posts/#{target.id}/deliver", headers: admin_headers, as: :json
      }.to have_enqueued_job(DeliverPostJob)

      expect(response).to have_http_status(:accepted)
      expect(target.reload.delivered_at).to be_present
    end

    it "下書きは配信できない" do
      target = create_post(slug: "draft", published_at: nil)

      expect {
        post "/api/v1/admin/posts/#{target.id}/deliver", headers: admin_headers, as: :json
      }.not_to have_enqueued_job(DeliverPostJob)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "二重には配信しない" do
      target = create_post(slug: "once", delivered_at: Time.current)

      expect {
        post "/api/v1/admin/posts/#{target.id}/deliver", headers: admin_headers, as: :json
      }.not_to have_enqueued_job(DeliverPostJob)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "ジョブは確認済みの全員に届け、同じ人に二度は積まない" do
      another = create(:user, :confirmed)
      target = create_post(slug: "news-1", title: "新機能")

      DeliverPostJob.perform_now(target.id)
      first = Notification.where(kind: "announcement").count
      expect(first).to eq(User.where.not(confirmed_at: nil).count)
      expect(Notification.where(kind: "announcement", user_id: [ reader.id, another.id ]).count).to eq(2)

      DeliverPostJob.perform_now(target.id)
      expect(Notification.where(kind: "announcement").count).to eq(first)
    end

    it "未確認の人には届けない" do
      create(:user)
      target = create_post(slug: "news-2")

      DeliverPostJob.perform_now(target.id)

      delivered_user_ids = Notification.where(kind: "announcement").pluck(:user_id)
      expect(delivered_user_ids).to all(satisfy { |id| User.find(id).confirmed_at.present? })
    end
  end
end
