require "rails_helper"

# 「その日来た人」を数えるための記録。
#
# 読むだけの画面（未読数・残高）は定期的に叩かれるので、毎回書くと
# その回数だけ行ロックと WAL が増える。**1日1回しか書かない**ことを固定する。
RSpec.describe "来訪の記録（last_seen_at）", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  def unread_count_request
    get "/api/v1/notifications/unread_count", headers: headers
  end

  # users への UPDATE だけを数える。認証まわりの users 更新（トークン再発行）は
  # 同じ表を触るので、last_seen_at を含む文だけに絞る。
  def count_last_seen_updates
    count = 0
    sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      count += 1 if payload[:sql].to_s.match?(/UPDATE "users".*last_seen_at/m)
    end
    yield
    count
  ensure
    ActiveSupport::Notifications.unsubscribe(sub)
  end

  it "認証済みのリクエストで、その日の来訪が記録される" do
    expect { unread_count_request }.to change { user.reload.last_seen_at }.from(nil)
    expect(response).to have_http_status(:ok)
  end

  it "同じ日に何度叩かれても、書き込みは1回だけ" do
    unread_count_request # 1回目で記録される

    writes = count_last_seen_updates do
      3.times { unread_count_request }
    end

    expect(writes).to eq(0)
  end

  it "日付が変わると、その日のぶんを1回だけ書く" do
    travel_to(Time.zone.local(2026, 8, 12, 10)) { unread_count_request }

    travel_to(Time.zone.local(2026, 8, 13, 10)) do
      writes = count_last_seen_updates { 2.times { unread_count_request } }
      expect(writes).to eq(1)
      expect(user.reload.last_seen_at.to_date).to eq(Date.new(2026, 8, 13))
    end
  end

  it "記録に失敗しても、応答は壊さない" do
    allow_any_instance_of(User).to receive(:touch_last_seen!).and_raise(StandardError, "boom")

    unread_count_request

    expect(response).to have_http_status(:ok)
  end

  it "認証していないリクエストでは記録しない" do
    expect {
      get "/api/v1/notifications/unread_count"
    }.not_to(change { user.reload.last_seen_at })

    expect(response).to have_http_status(:unauthorized)
  end
end
