require "rails_helper"

RSpec.describe "Api::V1::Items index sort/filter", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  def titles_in_response
    json_response["items"].map { |i| i["title"] }
  end

  describe "ステータスフィルタ" do
    it "status=completed で完了カードのみ返す" do
      create(:item, :completed, user: user, title: "done")
      create(:item, :failed, user: user, title: "fail")

      get "/api/v1/items", params: { status: "completed" }, headers: headers

      expect(titles_in_response).to eq([ "done" ])
    end

    it "不正な status は無視して全件返す" do
      create(:item, :completed, user: user, title: "a")
      create(:item, :failed, user: user, title: "b")

      get "/api/v1/items", params: { status: "bogus" }, headers: headers

      expect(titles_in_response).to contain_exactly("a", "b")
    end
  end

  describe "並び替え" do
    before do
      create(:item, user: user, title: "banana", created_at: 2.days.ago)
      create(:item, user: user, title: "apple", created_at: 1.day.ago)
    end

    it "デフォルトは作成日の新しい順" do
      get "/api/v1/items", headers: headers
      expect(titles_in_response).to eq([ "apple", "banana" ])
    end

    it "sort=created_at&direction=asc で古い順" do
      get "/api/v1/items", params: { sort: "created_at", direction: "asc" }, headers: headers
      expect(titles_in_response).to eq([ "banana", "apple" ])
    end

    it "sort=title&direction=asc で名前順" do
      get "/api/v1/items", params: { sort: "title", direction: "asc" }, headers: headers
      expect(titles_in_response).to eq([ "apple", "banana" ])
    end

    it "不正な sort はデフォルト（新しい順）にフォールバックする" do
      get "/api/v1/items", params: { sort: "id; DROP TABLE items" }, headers: headers
      expect(response).to have_http_status(:success)
      expect(titles_in_response).to eq([ "apple", "banana" ])
    end
  end
end
