require "rails_helper"

RSpec.describe "Api::V1::Auth::Registrations#update", type: :request do
  let(:user) { create(:user, :confirmed, email: "owner-#{SecureRandom.hex(4)}@example.com") }
  let(:headers) { auth_headers_for(user) }

  describe "メールアドレス変更のブロック（GHSA-57hq-95w6-v4fc 緩和）" do
    it "別メールへの変更は 422 で拒否し、メールを変更しない" do
      original = user.email

      put "/api/v1/auth", params: { email: "attacker-#{SecureRandom.hex(4)}@example.com" }, headers: headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to include("メールアドレスの変更は現在ご利用いただけません。")
      expect(user.reload.email).to eq(original)
      expect(user.unconfirmed_email).to be_nil
    end

    it "現在と同じメールを送っても拒否されず、他項目の更新は通る" do
      put "/api/v1/auth",
        params: { email: user.email, password: "newpassword123", password_confirmation: "newpassword123" },
        headers: headers

      expect(response).to have_http_status(:ok)
      expect(user.reload.email).to eq(user.email)
    end

    it "メール未指定の更新は従来どおり通る" do
      put "/api/v1/auth",
        params: { password: "anotherpass123", password_confirmation: "anotherpass123" },
        headers: headers

      expect(response).to have_http_status(:ok)
    end
  end
end
