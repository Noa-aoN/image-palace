require "rails_helper"

# アチーブメントの画面が「定義や持ち物の数に比例して問い合わせが増えない」ことを見張る。
#
# 実績 44・ミッション 28・獲得物 112 の定義があり、その一つひとつに
# `RewardDefinition.find_by(key:)` と `image.attached?` を投げていた。
# 1画面 **779 本**。本番は Fly sin ↔ Neon なので、本数がそのまま待ち時間になる。
#
# 速さそのものは環境で変わるので測らない。**問い合わせの本数**だけを見る。
RSpec.describe "アチーブメントの問い合わせ本数", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  # 直したあとの実測は 40 本。増える余地を少しだけ見て、
  # **桁が変わったら気づく**ところに置く（779 本に戻れば必ず落ちる）
  MAX_QUERIES = 60

  def warm_up
    # 1回目は組み込みの取り込みと認証で余分に走る
    get "/api/v1/achievements", headers: headers
  end

  it "1画面ぶんの問い合わせが決めた本数を超えない" do
    warm_up

    count = count_queries { get "/api/v1/achievements", headers: headers }

    expect(response).to have_http_status(:ok)
    expect(count).to be <= MAX_QUERIES, "問い合わせが #{count} 本に増えている（上限 #{MAX_QUERIES}）"
  end

  # ここが肝。**獲得物を増やしても本数が変わらない**こと。
  # 以前は持ち物ごとに定義を引き直していたので、集めるほど遅くなった。
  #
  # 落ち着いたところで測る。獲得物が10個・30個を超えた直後の1回だけは、
  # 「獲得物を10個集める」等が解けて配る側の書き込みが乗る。
  # あれは**そのとき限りの仕事**で、集めた数に比例するものではない。
  def steady_count
    get "/api/v1/achievements", headers: headers
    count_queries { get "/api/v1/achievements", headers: headers }
  end

  def grant!(range)
    RewardDefinition.registry[range].each do |reward|
      Achievements::Granter.grant(user: user, reward: reward, source: "manual", notify: false)
    end
  end

  it "獲得物を増やしても問い合わせの本数は増えない" do
    warm_up
    few = steady_count

    grant!(0..7)
    eight = steady_count
    grant!(8..47)
    many = steady_count

    expect(user.user_rewards.count).to be >= 40
    # 5本の幅は、種別ごとの集計（上限4種）が持ち物ゼロでは走らないぶん。
    # **数に比例していれば 40 件で桁が変わる**ので、これで捕まる
    expect(many - few).to be <= 5, "獲得物を48個にしたら #{few} → #{many} 本に増えた"
    expect(many).to be <= eight + 3, "8個 #{eight} → 48個 #{many} 本。数に比例している"
  end

  # 定義表は1つの応答の中で8回以上引かれる。読み直していないことを直に見る
  it "同じ定義表を読み直さない" do
    warm_up

    reads = 0
    sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      reads += 1 if payload[:sql].to_s.match?(/FROM "reward_definitions"/)
    end
    get "/api/v1/achievements", headers: headers
    ActiveSupport::Notifications.unsubscribe(sub)

    # 一覧の取得と、条件の判定でごく少数。**定義の数だけ引いていたら通らない**
    expect(reads).to be <= 5, "獲得物の定義を #{reads} 回読んでいる"
  end

  # 進み具合が変わっていないのに書き込むと、開くたびに 50〜70 本の UPDATE が走る
  it "進み具合が変わっていなければ書き込まない" do
    warm_up
    get "/api/v1/achievements", headers: headers

    writes = 0
    sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      writes += 1 if payload[:sql].to_s.match?(/UPDATE "(user_achievements|user_missions)"/)
    end
    get "/api/v1/achievements", headers: headers
    ActiveSupport::Notifications.unsubscribe(sub)

    expect(writes).to eq(0), "変わっていないのに #{writes} 本の UPDATE が飛んでいる"
  end
end
