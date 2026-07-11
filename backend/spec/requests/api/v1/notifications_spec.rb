require "rails_helper"

RSpec.describe "Api::V1::Notifications", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:other_user) { create(:user, :confirmed) }

  describe "認証ガード" do
    it "未認証では 401 を返す" do
      notification = create(:notification, user: user)

      get "/api/v1/notifications"
      expect(response).to have_http_status(:unauthorized)

      get "/api/v1/notifications/unread_count"
      expect(response).to have_http_status(:unauthorized)

      post "/api/v1/notifications/#{notification.id}/read"
      expect(response).to have_http_status(:unauthorized)

      post "/api/v1/notifications/read_all"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/notifications" do
    it "自分の通知を新しい順に返し、未読数とページ情報を含む" do
      create(:notification, user: user, title: "古い通知", created_at: 2.hours.ago)
      create(:notification, :read, user: user, title: "既読の通知", created_at: 1.hour.ago)
      create(:notification, user: user, title: "新しい通知", created_at: 1.minute.ago)

      get "/api/v1/notifications", headers: headers

      expect(response).to have_http_status(:ok)
      titles = json_response["notifications"].map { |n| n["title"] }
      expect(titles).to eq([ "新しい通知", "既読の通知", "古い通知" ])
      expect(json_response["unread_count"]).to eq(2)
      expect(json_response["meta"]).to include("page" => 1, "total_count" => 3)
      expect(json_response["notifications"].first).to include("kind", "url", "payload", "read", "created_at")
    end

    it "他ユーザーの通知は含まない" do
      create(:notification, user: other_user, title: "他人の通知")

      get "/api/v1/notifications", headers: headers

      expect(json_response["notifications"]).to be_empty
      expect(json_response["unread_count"]).to eq(0)
    end

    it "per でページサイズを絞れる" do
      create_list(:notification, 3, user: user)

      get "/api/v1/notifications", params: { per: 2 }, headers: headers

      expect(json_response["notifications"].size).to eq(2)
      expect(json_response["meta"]).to include("per" => 2, "total_pages" => 2)
    end
  end

  describe "GET /api/v1/notifications/unread_count" do
    it "未読数だけを返す" do
      create_list(:notification, 2, user: user)
      create(:notification, :read, user: user)

      get "/api/v1/notifications/unread_count", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response).to eq({ "unread_count" => 2 })
    end
  end

  describe "POST /api/v1/notifications/:id/read" do
    it "指定した通知を既読にする" do
      notification = create(:notification, user: user)

      post "/api/v1/notifications/#{notification.id}/read", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response["read"]).to be(true)
      expect(notification.reload).to be_read
    end

    it "他ユーザーの通知は既読にできず 404 を返す" do
      notification = create(:notification, user: other_user)

      post "/api/v1/notifications/#{notification.id}/read", headers: headers

      expect(response).to have_http_status(:not_found)
      expect(notification.reload).not_to be_read
    end
  end

  describe "POST /api/v1/notifications/read_all" do
    it "自分の未読をすべて既読にする" do
      create_list(:notification, 2, user: user)
      others_notification = create(:notification, user: other_user)

      post "/api/v1/notifications/read_all", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response).to eq({ "unread_count" => 0 })
      expect(user.notifications.unread).to be_empty
      expect(others_notification.reload).not_to be_read
    end
  end
end
