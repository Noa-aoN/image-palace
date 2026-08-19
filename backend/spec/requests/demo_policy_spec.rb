# frozen_string_literal: true

require "rails_helper"

# 体験用の宮殿で、禁じたものが本当に通らないか。
#
# **同じ操作を普通の利用者でも叩く。** 絞りすぎて、
# 一般の人まで使えなくなっていないことを、同じ場所で確かめるため。
RSpec.describe "体験用の宮殿で禁じている操作", type: :request do
  # 目印はメールの後ろ側。列を足さずに済み、消せば痕跡も残らない
  let(:demo) { create(:user, :confirmed, email: "demo-#{SecureRandom.hex(4)}@#{User::DEMO_EMAIL_DOMAIN}") }
  let(:normal) { create(:user, :confirmed) }

  def headers_for(user) = user.create_new_auth_token

  # 入口を叩く。
  #
  # **中身が無いときは `params:` を渡さない。** 空のハッシュを `as: :json` で送ると
  # GET の経路が壊れて 404 になる（アプリではなく、書き方の問題）
  def hit(endpoint, user)
    options = { headers: headers_for(user), as: :json }
    options[:params] = endpoint[:params] if endpoint[:params].present?
    public_send(endpoint[:method], endpoint[:path], **options)
  end

  # 禁じている入口。**一覧に足せば、確かめる例も自動で増える**
  FORBIDDEN_ENDPOINTS = [
    { name: "決済の開始", method: :post, path: "/api/v1/billing/checkout", params: { plan: "standard" } },
    { name: "支払いの管理", method: :post, path: "/api/v1/billing/portal" },
    { name: "持ち出し", method: :get, path: "/api/v1/account/export" },
    { name: "アカウントの削除", method: :delete, path: "/api/v1/account" },
    { name: "二要素の設定", method: :post, path: "/api/v1/totp" },
    { name: "Passkey の登録", method: :post, path: "/api/v1/passkeys" },
    { name: "引き換えコード", method: :post, path: "/api/v1/campaign_codes/redeem", params: { code: "ABC123" } }
  ].freeze

  describe "体験用の口座" do
    FORBIDDEN_ENDPOINTS.each do |endpoint|
      it "#{endpoint[:name]}はできない" do
        hit(endpoint, demo)

        expect(response).to have_http_status(:forbidden)
        expect(json_response["code"]).to eq("demo_forbidden")
        expect(json_response["error"]).to match(/体験版では/)
      end
    end

    it "パスワードは変えられない" do
      put "/api/v1/auth", params: { password: "new-password-123", password_confirmation: "new-password-123" },
                          headers: headers_for(demo), as: :json

      expect(response).to have_http_status(:forbidden)
      expect(demo.reload.valid_password?("new-password-123")).to be(false)
    end
  end

  # ここが大事。**普通の利用者には何も影響していない**
  describe "普通の利用者" do
    it "同じ入口で、禁止の断りは返らない" do
      FORBIDDEN_ENDPOINTS.each do |endpoint|
        # 消す入口があるので、毎回そのためだけの利用者を用意する
        hit(endpoint, create(:user, :confirmed))

        # 中身の無い応答（削除の 204 など）もあるので、本文を直に見る
        expect(response.body).not_to include("demo_forbidden"),
                                     "#{endpoint[:name]} が普通の利用者にも禁じられている"
      end
    end

    it "持ち出しはできる" do
      get "/api/v1/account/export", headers: headers_for(normal), as: :json

      expect(response).to have_http_status(:success)
    end
  end

  # 中心の体験は残す。**ここが通らなくなったら、デモの意味が無い**
  describe "体験用でもできること" do
    let(:item_type) { create(:item_type) }
    let!(:item) { demo.items.create!(title: "見本", item_type: item_type, generation_status: "completed") }

    it "カードを見る" do
      get "/api/v1/items", headers: headers_for(demo), as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["items"].size).to eq(1)
    end

    it "カードを直す" do
      patch "/api/v1/items/#{item.id}", params: { item: { title: "直した" } },
                                        headers: headers_for(demo), as: :json

      expect(response).to have_http_status(:success)
      expect(item.reload.title).to eq("直した")
    end

    it "キャンバスを作って動かす" do
      post "/api/v1/views", params: { name: "ためし", view_type: "freeboard" },
                            headers: headers_for(demo), as: :json

      expect(response).to have_http_status(:success).or have_http_status(:created)
    end

    it "料金の一覧は読める" do
      get "/api/v1/billing/plans", headers: headers_for(demo), as: :json

      expect(response).to have_http_status(:success)
    end
  end

  describe "目印" do
    it "後ろ側が体験用の綴りなら、体験用" do
      expect(demo).to be_demo
      expect(normal).not_to be_demo
    end

    it "数えるときは外れる" do
      demo
      normal

      expect(User.external).to include(normal)
      expect(User.external).not_to include(demo)
    end

    it "大文字でも見分ける" do
      loud = build(:user, email: "X@#{User::DEMO_EMAIL_DOMAIN.upcase}")

      expect(loud).to be_demo
    end
  end

  describe "DemoPolicy" do
    it "一覧に無いものは、体験用でもできる" do
      expect(DemoPolicy.allow?(demo, :read_items)).to be(true)
      expect(DemoPolicy.allow?(demo, :create_view)).to be(true)
    end

    it "一覧にあるものは、体験用だとできない" do
      DemoPolicy::FORBIDDEN.each do |capability|
        expect(DemoPolicy.allow?(demo, capability)).to be(false), "#{capability} が通っている"
      end
    end

    it "普通の利用者は、一覧のものも全部できる" do
      DemoPolicy::FORBIDDEN.each do |capability|
        expect(DemoPolicy.allow?(normal, capability)).to be(true)
      end
    end

    it "断りの言い方は、どの入口でも揃っている" do
      DemoPolicy::FORBIDDEN.each do |capability|
        expect(DemoPolicy.message(capability)).to start_with("体験版では")
      end
    end
  end

  # 中の人の口座が混ざると、伸びているように見えて実は増えていない、が起きる。
  # **各所の SQL に条件を散らさず、scope 1つで効かせている**ことを確かめる
  describe "数えるとき、中の人は外れる" do
    around do |example|
      original = ENV["OFFICIAL_CONTENT_EMAIL"]
      ENV["OFFICIAL_CONTENT_EMAIL"] = "official@example.com"
      example.run
      ENV["OFFICIAL_CONTENT_EMAIL"] = original
    end

    let!(:real_people) { create_list(:user, 2, :confirmed) }
    let!(:demo_account) { create(:user, :confirmed, email: "d-#{SecureRandom.hex(4)}@#{User::DEMO_EMAIL_DOMAIN}") }
    let!(:official_account) { create(:user, :confirmed, email: "official@example.com") }

    it "利用者の数から外れる" do
      expect(User.count).to eq(4)
      expect(User.external.count).to eq(2)
    end

    it "運営が見る「利用者の伸び」からも外れる" do
      admin = create(:user, :confirmed, role: "admin")

      get "/api/v1/admin/users", headers: headers_for(admin), as: :json

      expect(response).to have_http_status(:success)
      # admin 自身も普通の利用者として数える
      expect(json_response.dig("stats", "total")).to eq(3)
    end

    it "一覧そのものには出る（運営から見えないほうが困る）" do
      admin = create(:user, :confirmed, role: "admin")

      get "/api/v1/admin/users", headers: headers_for(admin), as: :json

      emails = json_response["users"].map { |u| u["email"] }
      expect(emails).to include(demo_account.email, official_account.email)
    end

    it "体験用だけを引ける" do
      expect(User.demo_accounts).to contain_exactly(demo_account)
    end
  end

  describe "公式コンテンツの口座" do
    around do |example|
      original = ENV["OFFICIAL_CONTENT_EMAIL"]
      ENV["OFFICIAL_CONTENT_EMAIL"] = "official@example.com"
      example.run
      ENV["OFFICIAL_CONTENT_EMAIL"] = original
    end

    it "指した口座だけが、原本の持ち主になる" do
      official = create(:user, :confirmed, email: "official@example.com")

      expect(official).to be_official_content_account
      expect(normal).not_to be_official_content_account
    end

    it "数えるときは外れる" do
      official = create(:user, :confirmed, email: "official@example.com")

      expect(User.external).not_to include(official)
      expect(User.external).to include(normal)
    end

    # 原本を持つことと、工房を使えることは別。**役割で決まる**
    it "工房を使えるかは、役割で決まる" do
      expect(normal.can_manage_official_content?).to be(false)
      expect(create(:user, :confirmed, role: "operator").can_manage_official_content?).to be(true)
      expect(create(:user, :confirmed, role: "admin").can_manage_official_content?).to be(true)
    end

    # 原本の口座でも、権限が無ければ工房は開けない
    it "原本を持っていても、役割が無ければ工房は使えない" do
      official = create(:user, :confirmed, email: "official@example.com")

      expect(official).to be_official_content_account
      expect(official.can_manage_official_content?).to be(false)
    end
  end
end
