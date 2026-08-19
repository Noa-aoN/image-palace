class User < ApplicationRecord
  # == Deviseモジュール ======================================================
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :confirmable,
         :omniauthable, omniauth_providers: [ :google_oauth2, :apple ]

  # == devise-token-auth設定 ================================================
  include DeviseTokenAuth::Concerns::User

  # == 役割 ==================================================================
  #   user     … 一般。/admin には入れない
  #   support  … 閲覧・調査。見るだけで、配ったり変えたりはできない
  #   operator … 通常運用。読みもの配信・コード発行・付与・設定変更
  #   admin    … 最上位。権限・お金・セキュリティを触れる唯一の段階
  #
  # **上位は下位を含む。** 機能ごとに許可の一覧を持たせると、機能が増えるたびに
  # 全段階を見直すことになる。順位で比べる（at_least?）。
  #
  # 権限の在り処は DB にする。将来チームが増えても、譲渡することになっても、
  # 環境変数を触らずに人を足したり移したりできるようにするため。
  #
  # ENV の ADMIN_EMAILS は「最初のひとり」を作るための入口であり、
  # **締め出されたときの逃げ道**でもある。ここに書いた確認済みのアドレスは、
  # DB の role が何であっても admin として扱う。ここを塞いではいけない
  # （実際、いまの運営はこの経路だけで権限を持っている）。
  ROLES = %w[user support operator admin].freeze
  ROLE_RANK = { "user" => 0, "support" => 1, "operator" => 2, "admin" => 3 }.freeze
  validates :role, inclusion: { in: ROLES }

  # == バリデーション =========================================================
  validates :uid, uniqueness: { scope: :provider }

  # 表示名。外部アカウントの名前を登録時の初期値として入れてあるだけで、以後は本人が変えられる。
  # 空にしたら「未設定」に戻す（画面側でメールのローカル部から作った既定名を出す）
  validates :name, length: { maximum: 50 }
  normalizes :name, with: ->(name) { name.to_s.gsub(/[[:cntrl:]]/, "").strip.presence }

  # == 二要素認証 ============================================================
  # 秘密鍵は暗号化して持つ。生のまま置くと、DB が漏れた時点で
  # 二要素が二要素でなくなる
  encrypts :totp_secret

  # 復旧コードの本数。少ないと端末を失ったときに足りず、
  # 多いと控えるのが面倒になって結局どこにも残されない
  TOTP_RECOVERY_CODE_COUNT = 10

  # == 関連付け ==============================================================
  has_one :setting, dependent: :destroy
  # Passkey / セキュリティキー。1人が何本でも持てる
  # （1本しか登録できないと、その端末を失った時点で入れなくなる）
  has_many :webauthn_credentials, dependent: :destroy
  # 強い確認を通った端末。利用者ではなく端末ごとに持つ
  # （机のパソコンで確かめた結果が、置き忘れた携帯に効いてはいけない）
  has_many :strong_auth_sessions, dependent: :destroy
  has_many :items, dependent: :destroy
  has_many :property_definitions, dependent: :destroy
  has_many :item_reviews, dependent: :destroy
  has_many :boxes, dependent: :destroy
  has_many :spaces, dependent: :destroy
  has_many :space_points, through: :spaces
  has_many :views, dependent: :destroy
  # アチーブメント（栄誉の間）
  has_many :user_rewards, dependent: :destroy
  has_many :user_achievements, dependent: :destroy
  has_many :user_missions, dependent: :destroy
  has_one :user_stat, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :tag_groups, dependent: :destroy
  has_many :wordlists, dependent: :destroy
  has_many :relations, dependent: :destroy
  has_many :shared_medias, dependent: :destroy
  has_many :subscriptions, dependent: :destroy
  # trialing も「有効な有料契約」として扱う（trial 中ユーザーに無料枠を二重付与しないため）。
  has_one :active_subscription, -> { where(status: %w[active trialing]) }, class_name: "Subscription"
  has_many :notifications, dependent: :destroy
  has_many :credit_transactions, dependent: :destroy
  has_many :credit_grants, dependent: :destroy
  # 公式コンテンツを受け取った履歴
  has_many :content_installations, dependent: :destroy

  # == 退会したときに、何を消して何を残すか ====================================
  #
  # **どれも外部キーが張ってある。** 後片付けを書き忘れると、
  # 消そうとした瞬間に落ちる（実際、実績を1つでも持っていると
  # `DELETE /account` が 500 になっていた）。
  #
  # 本人のものは一緒に消す。**記録として要るものは、持ち主だけ外して残す**
  # （誰がやったかは消えるが、何が起きたかは残る）。
  has_many :user_reward_grants, dependent: :destroy
  has_many :campaign_redemptions, dependent: :destroy
  has_many :webauthn_challenges, dependent: :destroy

  # 原価の記録。金額は残さないと、過去の集計が変わってしまう
  has_many :ai_usages, dependent: :nullify
  # 運営の記録。**誰がやったかは消えるが、何が起きたかは残す**
  has_many :admin_audit_logs, foreign_key: :actor_id, inverse_of: :actor, dependent: :nullify
  has_many :admin_briefs, foreign_key: :generated_by_id, inverse_of: :generated_by, dependent: :nullify
  has_many :authored_posts, class_name: "Post", foreign_key: :author_id,
                            inverse_of: :author, dependent: :nullify
  has_many :created_campaign_codes, class_name: "CampaignCode", foreign_key: :created_by_id,
                                    inverse_of: :created_by, dependent: :nullify
  has_many :user_activity_days, dependent: :delete_all

  # == プロフィールアイコン（AI生成）========================================
  # GenerateAvatarJob が生成画像を添付する。avatar_thumb は一覧/ヘッダー用のサムネ。
  has_one_attached :avatar
  has_one_attached :avatar_thumb

  AVATAR_GENERATION_STATUSES = %w[pending processing completed failed].freeze

  # 生成ステータス遷移（エラーはクリア）。
  def update_avatar_status!(status)
    update!(avatar_generation_status: status, avatar_generation_error: nil)
  end

  # 生成失敗（ユーザー向け文言を保存）。
  def mark_avatar_failed!(message)
    update!(avatar_generation_status: "failed", avatar_generation_error: message)
  end

  # 当月の生成数。カード（items）と、名前付きスペースポイント（画像生成を伴う）を
  # 合算して数える。枚数の上限はクレジット残高で決まるので、これは実績の集計。
  def monthly_generation_count
    items.created_this_month.count + space_points.named.created_this_month.count
  end

  # == クレジット =============================================================
  # 残高は3つの入れ物：期限付きグラント（credit_grants）+ subscription_credits（当月分）
  # + topup_credits（期限を持たない古い買い切り）。どれも受け取りから同じ長さで期限が来る
  # （長さは Billing::CreditExpiryPolicy）。
  # 履歴は credit_transactions に追記する（監査用の append-only 台帳）。
  class InsufficientCredits < StandardError; end

  # 残高（ポイント）。期限付きグラント + subscription_credits + topup_credits の合算。
  def available_credit_points
    grant_credit_points + subscription_credits + topup_credits
  end

  # 有効な期限付きグラントの残量合計（ポイント）。
  def grant_credit_points
    credit_grants.active.sum(:remaining_points)
  end

  # 表示用クレジット（1cr = Billing::POINTS_PER_CREDIT pt）。
  def available_credits
    available_credit_points.fdiv(Billing::POINTS_PER_CREDIT)
  end

  # 無料枠を整える。登録直後の「お試し」と、毎月の少量。
  #
  # 無料枠は回収の当てがない支出なので、配る量も配る相手も絞る。
  #   お試し … 1回だけ。退会して登録し直しても再取得できない
  #   毎月分 … 訪れた人にだけ配る（来ない人には配られない）
  #
  # 有料契約がある人には配らない（プランのぶんが毎月届くため）。
  #
  # 「配ったか」を見てから配るので、行ロックの中で判断する。
  # 外でやると、同時に来たリクエストが揃って「まだ配っていない」を読み、
  # 人数分だけ配ってしまう（残高エンドポイントは画面が繰り返し叩くので、
  # 並べて投げるだけで何回でも受け取れてしまっていた）。
  def ensure_free_credits!
    return if active_subscription.present?
    # ほとんどの呼び出しは「もう配ってある」で終わる。そこでロックを取ると
    # 同じ人のリクエストが一列に並んでしまうので、先に安い判定で抜ける。
    return if free_grants_settled?

    with_lock do
      reload
      grant_trial_credits!
      grant_monthly_free_credits!
    end
  end

  # == 来訪の記録 =============================================================

  # 「その日、来た」を1日1回だけ残す。DAU / WAU / MAU の素。
  #
  # 毎リクエスト書くと、読むだけの画面（残高・未読数は定期的に叩かれる）でも
  # 書き込みが走り、行ロックと WAL がその回数だけ増える。**日付が変わったときだけ**にする。
  #
  # `update_column` を使うのは、ここが利用者の操作ではないため。
  # コールバックもバリデーションも要らず、`updated_at` を動かすと
  # 「利用者が何かを変えた時刻」の意味が壊れる。
  #
  # 競合しても困らない。同じ日に2つのリクエストが同時に来て両方が書いても、
  # 入る値は同じ日付で、数える側は日付でしか見ない。
  def touch_last_seen!
    return if seen_today?

    update_column(:last_seen_at, Time.current) # rubocop:disable Rails/SkipsModelValidations
    # 「その日活動した」を1行だけ残す。last_seen_at と同じ入口に相乗りするので、
    # 書き込みは1日1回で済む（2回目以降はここまで来ない）
    UserActivityDay.record!(id)
  end

  def seen_today?
    last_seen_at.present? && last_seen_at.in_time_zone.to_date == Time.zone.today
  end

  # お試しも今期の毎月分も配り終えているか（ロックを取る前の早期判定）
  def free_grants_settled?
    trial_granted_at.present? &&
      credits_period_start.present? &&
      credits_period_start >= free_period_start
  end

  # 旧名。呼び出し側を一度に直さないための入口（意味は「無料枠を整えておく」で変わらない）
  alias ensure_current_period_credits! ensure_free_credits!

  def mark_trial_granted!
    update_column(:trial_granted_at, Time.current) # rubocop:disable Rails/SkipsModelValidations
  end

  # 配った相手を照合するための識別子。アカウントを消しても残す方に渡す
  def trial_identifiers
    identifiers = { email: email }
    identifiers[:oauth] = "#{provider}:#{uid}" if provider.present? && provider != "email" && uid.present?
    identifiers
  end

  private

  def grant_trial_credits!
    return if trial_granted_at.present?

    # 付与量は管理画面から変えられる（GrantPolicy）。行が無ければ Catalog の既定
    amount = GrantPolicy.amount_for("trial") * Billing::POINTS_PER_CREDIT
    # 配らない設定でも印は付ける。付けないと free_grants_settled? が常に外れ、
    # ensure_free_credits! が毎リクエストで行ロックを取ってしまう
    return mark_trial_granted! if amount <= 0

    # 一度配った相手には配らない。退会して登録し直しても同じ
    return mark_trial_granted! if TrialGrantRecord.granted?(trial_identifiers)
    # 配りすぎのブレーカー。当たった場合は配らないが、印は付けて何度も試させない
    return mark_trial_granted! unless Billing::FreeGrantGuard.allow?(amount)

    grant_credits!(amount, kind: "trial", expires_at: Billing::CreditExpiryPolicy.expires_at)
    TrialGrantRecord.remember!(trial_identifiers)
    mark_trial_granted!
  end

  # 月に一度、少量だけ。来た人にしか配らないので、休眠アカウントには出ていかない
  def grant_monthly_free_credits!
    period_start = free_period_start
    return if credits_period_start && credits_period_start >= period_start

    amount = GrantPolicy.amount_for("monthly_free") * Billing::POINTS_PER_CREDIT
    # 配らない設定でも周期の印は進める（進めないと毎リクエストで行ロックを取る）。
    # 一方、配りすぎのブレーカーに当たったときは進めない（上限が空いたら配りたいため）
    return advance_free_period!(period_start) if amount <= 0
    return unless Billing::FreeGrantGuard.allow?(amount)

    grant_credits!(amount, kind: "monthly_free", expires_at: Billing::CreditExpiryPolicy.expires_at)
    advance_free_period!(period_start)
  end

  def advance_free_period!(period_start)
    update_column(:credits_period_start, period_start) # rubocop:disable Rails/SkipsModelValidations
  end

  public

  # 無料枠の現周期の開始日時（登録日アニバーサリー基準・月次。有料の契約日周期と整合させる）。
  # 例: 1/15 登録なら毎月15日が周期境界。月末日は ActiveSupport が丸める（1/31→2/28 等）。
  def free_period_start(now = Time.current)
    anchor = created_at || now
    elapsed_months = (now.year - anchor.year) * 12 + (now.month - anchor.month)
    start = anchor + elapsed_months.months
    start -= 1.month if start > now
    start
  end

  # 次回の無料クレジット更新（回復）日。
  def next_free_credit_reset_at(now = Time.current)
    free_period_start(now) + 1.month
  end

  # 月額プランのぶんを当月分に入れ替える。invoice 支払い時などに呼ぶ。
  #
  # 使い残しは**失効させず、期限付きの持ち越しに移す**（CreditExpiryPolicy）。
  # 残高は減らないので、移し替えの台帳記録は残さない（グラント行そのものが記録になる）。
  #
  # forfeit: true を渡すと没収する。**いまは誰も渡していない。**
  # 解約時に没収していたが、規約は出どころによらず「付与から3か月」と定めていて、
  # 解約を理由に取り上げるとその約束と食い違う（#704 の次で直した）。
  #
  # 「契約→受け取り→即解約」で使い回される心配はある。ただし受け取れるのは
  # 1か月ぶんで、次の付与は解約と同時に止まる。**約束を曲げてまで塞ぐ穴ではない。**
  # 逃げ道として引数は残す（不正が実際に出たら、そこで判断できるように）。
  def reset_subscription_credits!(amount, subscription: nil, stripe_event_id: nil, amount_cents: nil,
                                  currency: nil, forfeit: false)
    with_lock do
      if forfeit
        forfeited = subscription_credits
        record_credit!(kind: "subscription_expire", delta: -forfeited, subscription:) if forfeited.positive?
      else
        carry_over_subscription_credits!
      end
      update!(subscription_credits: amount)
      # 解約時の失効（amount==0）では 0 デルタの付与ログを残さない。
      if amount.positive?
        record_credit!(kind: "subscription_grant", delta: amount, subscription:, stripe_event_id:, amount_cents:, currency:)
      end
    end
  end

  # Top-up（買い切り）クレジットを加算する。
  # 買い切りも期限付きで積む。
  # 以前は無期限の入れ物（topup_credits）に入れていたため、期限が効かなかった。
  # 既に入っているぶんはそのまま残し、消費順では最後に回る（＝先に期限付きが使われる）。
  def add_topup_credits!(amount, stripe_event_id: nil, amount_cents: nil, currency: nil)
    with_lock do
      credit_grants.create!(
        kind: "topup",
        amount_points: amount,
        remaining_points: amount,
        expires_at: Billing::CreditExpiryPolicy.expires_at,
        # **どの決済で積んだ束か**を、束そのものに残す。
        # 返金が来たときに「どれを戻すか」を選べるようにするため
        # （台帳の行にしか無いと、束と決済を突き合わせられない）。
        # 鍵は付与に使ったものと同じ（買い切りなら checkout session の id）
        metadata: { "payment_key" => stripe_event_id }.compact
      )
      record_credit!(kind: "topup_purchase", delta: amount, stripe_event_id:, amount_cents:, currency:)
    end
  end

  # 月額プランの使い残しを、期限付きの持ち越しに移す。
  #
  # 当月ぶんは subscription_credits に1ヶ月だけ居る。
  # 残りの寿命を「寿命 − 1ヶ月」にすると、届いた日から数えてちょうど寿命ぶん使えることになる。
  #
  # grant_credits! は使わない。あれは残高が増えるときの入口で、台帳に付与を書く。
  # ここは入れ物を移すだけで残高は変わらないため、書くと増えたように見えてしまう。
  def carry_over_subscription_credits!
    leftover = subscription_credits
    return if leftover <= 0

    credit_grants.create!(
      kind: "subscription_carryover", amount_points: leftover, remaining_points: leftover,
      expires_at: Billing::CreditExpiryPolicy.carryover_expires_at
    )
    update!(subscription_credits: 0)
  end

  # 期限付きグラント（Free引き継ぎ・キャンペーン等）を付与する。
  def grant_credits!(amount, kind:, expires_at: nil, metadata: {})
    return if amount <= 0

    with_lock do
      credit_grants.create!(kind:, amount_points: amount, remaining_points: amount, expires_at:, metadata:)
      record_credit!(kind: "grant", delta: amount)
    end
  end

  # 生成1件ぶんなどを消費する。期限付きグラント（期限が近い順）→ サブスク → Top-up の順に引く。
  # 期限が近いものから使う。
  #
  # 以前は「グラント → 月額分 → 買い切り」の順だった。種類で決めていたため、
  # 月末で消える月額分より先に、まだ数ヶ月ある期限付きグラントを使ってしまい、
  # 結果として消えなくてよかったぶんを失っていた。
  #
  # 種類ではなく期限で並べる。期限が無いものは最後（いくらでも待てるため）。
  def consume_credits!(amount, item: nil, space_point_id: nil)
    with_lock do
      raise InsufficientCredits, "クレジットが不足しています" if available_credit_points < amount

      remaining = amount
      consumption_sources.each do |source|
        break if remaining <= 0

        take = [ source[:points], remaining ].min
        next if take <= 0

        source[:consume].call(take)
        remaining -= take
      end
      record_credit!(kind: "consumption", delta: -amount, item:, space_point_id:)
    end
  end

  # 使える残高を、期限が近い順に並べたもの。
  # 期限が無いものは nil を最後に置く（無期限のまま置いておいても失われないため）。
  def consumption_sources
    sources = credit_grants.consume_order.map do |grant|
      {
        expires_at: grant.expires_at,
        points: grant.remaining_points,
        consume: ->(take) { grant.update!(remaining_points: grant.remaining_points - take) }
      }
    end

    if subscription_credits.positive?
      sources << {
        expires_at: subscription_expires_at,
        points: subscription_credits,
        consume: ->(take) { update!(subscription_credits: subscription_credits - take) }
      }
    end

    if topup_credits.positive?
      # 期限を持たない古い買い切り分。待てるので最後に回す
      sources << {
        expires_at: nil,
        points: topup_credits,
        consume: ->(take) { update!(topup_credits: topup_credits - take) }
      }
    end

    # 並べ直しても同着の順が入れ替わらないよう、最後に並びの位置を見る。
    # Ruby の sort_by は同着の順を保たないため、これが無いと
    # 同じ期限のグラントを引く順が実行のたびに変わり得る。
    sources.each_with_index
           .sort_by { |source, index| [ source[:expires_at] ? 0 : 1, source[:expires_at] || Time.current, index ] }
           .map(&:first)
  end

  # 月額プランのぶんが消えるとき。契約が無ければ無料枠の周期末
  def subscription_expires_at
    active_subscription&.current_period_end || next_free_credit_reset_at
  end

  # == クラスメソッド =========================================================
  # OAuthプロバイダーからユーザーを見出し作成
  # == 中の人の口座 ============================================================
  #
  # 普通の利用者ではない口座が2種類ある。
  #
  #   体験用 … ログイン不要で入れる、使い捨ての宮殿の持ち主
  #   公式   … 公式コンテンツの原本を持つ口座
  #
  # **役割（user / support / operator / admin）には足さない。**
  # あちらは「上位が下位を含む」順位で、体験用は一般より下ではないし、
  # 公式は権限の話ですらない（原本がどこにあるか、という話）。
  # `bootstrap_admin?` が役割と別の軸で ENV を見ているのと同じ形にする。
  #
  # 目印はメールの後ろ側。**列を足さずに済み、消せば痕跡も残らない。**
  # `.invalid` は誰も持てないと決まっている綴りなので、
  # 普通の登録とぶつかることがない
  DEMO_EMAIL_DOMAIN = "demo.invalid"

  # 体験用の口座か
  def demo?
    email.to_s.downcase.end_with?("@#{DEMO_EMAIL_DOMAIN}")
  end

  # 公式コンテンツの原本を持つ口座か。**誰が編集してよいか、ではない**
  def official_content_account?
    configured = ENV["OFFICIAL_CONTENT_EMAIL"].to_s.strip.downcase
    configured.present? && email.to_s.downcase == configured
  end

  # 公式工房を使える資格があるか。こちらは役割で決める（DB が正）
  def can_manage_official_content?
    at_least?("operator")
  end

  # 中の人の口座（体験用・公式）。**数えるときは外す**
  def internal?
    demo? || official_content_account?
  end

  # 数を出すときの母集団。
  #
  # **各所の SQL に条件を散らさない。** ここを直せば全部に効く。
  # 将来 `internal` の列や種別を足しても、呼ぶ側は変わらない
  scope :external, lambda {
    scope = where.not("LOWER(email) LIKE ?", "%@#{DEMO_EMAIL_DOMAIN}")
    official = ENV["OFFICIAL_CONTENT_EMAIL"].to_s.strip.downcase
    official.present? ? scope.where.not("LOWER(email) = ?", official) : scope
  }

  scope :demo_accounts, -> { where("LOWER(email) LIKE ?", "%@#{DEMO_EMAIL_DOMAIN}") }

  # == 認証の応答に載せる項目 ==================================================
  #
  # devise_token_auth の既定は `as_json(except: [:tokens, :created_at, :updated_at])`。
  # **列を足すたびに、それがそのまま画面へ流れる。**
  #
  # 実際、二要素認証の秘密鍵と復旧コードが平文で返っていた。
  # トークンは localStorage に置いているので、XSS ひとつで
  # **入る鍵と、二要素の鍵の両方**が同時に渡る。二要素が二要素でなくなる。
  # ほかに Stripe の顧客 ID・クレジット残高・Passkey の識別子も出ていた。
  #
  # **出すものを数え上げる。** 除くものを並べる形だと、
  # 次に足した列が既定で漏れる側に入る。
  #
  # 残高は /billing/summary、二要素の状態は /totp、
  # アバターは /account/profile が返す。ここに要らない。
  PUBLIC_ATTRIBUTES = %w[
    id uid email name provider role
    avatar_generation_status avatar_generation_error
    allow_password_change
  ].freeze

  # **既定を安全側に倒す。**
  #
  # `token_validation_response` を絞るだけでは足りなかった。
  # devise_token_auth は登録・パスワード変更・OAuth の応答で
  # `@resource.as_json` を素で呼んでおり、そちらから同じものが漏れていた
  # （spec で捕まえた）。入口ごとに塞ぐと、gem が経路を増やすたびに追う羽目になる。
  #
  # 指定して呼んだときは、その指定に従う（調べもの・書き出しのため）。
  def as_json(options = nil)
    return super if options.present?

    super(only: PUBLIC_ATTRIBUTES)
  end

  def token_validation_response
    as_json
  end

  # == 役割の判定 =============================================================
  # 環境変数の入口は「確認済みのアドレス」にだけ効かせる。
  # 未確認のうちから権限を持てると、アドレスを騙るだけで入れてしまうため。
  def bootstrap_admin?
    return false if confirmed_at.blank? || email.blank?

    self.class.bootstrap_admin_emails.include?(email.to_s.downcase)
  end

  # 表示・記録用の実効役割（環境変数由来の admin もそう見せる）
  def effective_role
    bootstrap_admin? ? "admin" : role
  end

  def role_rank
    ROLE_RANK.fetch(effective_role, 0)
  end

  # その段階以上か。上位は下位を含む
  def at_least?(role_name)
    role_rank >= ROLE_RANK.fetch(role_name.to_s)
  end

  # 運営の入口に入れるか（support 以上）
  def admin?
    at_least?("support")
  end

  # 権限・お金・セキュリティを触れるか
  def owner?
    at_least?("admin")
  end

  # 最上位が居なくなる変更か。
  #
  # 誰も admin でなくなると、権限を戻せる人が画面から消える。
  # ENV の逃げ道は残るが、それは非常口であって日常の扉ではない
  # （設定を触れる人が別に居るとは限らない）。
  #
  # 自分自身の降格も同じ理由で塞ぐ。「自分を降ろす」は、
  # 権限を持つ最後の1人がうっかり押せてしまう操作。
  def self.last_admin?(user)
    return false unless user.at_least?("admin")

    effective_admins.select { |candidate| candidate.at_least?("admin") }
                    .none? { |candidate| candidate.id != user.id }
  end

  # 認証器に渡す利用者の目印。
  #
  # **内部の利用者IDをそのまま渡さない。** user handle は認証器に保存され、
  # 端末を持つ人から読めることがある。ここから利用者数や登録順が
  # 推し量れる形にしない。
  #
  # 必要になった時点で作る（全員に前もって配る理由がない）
  def webauthn_handle
    return webauthn_id if webauthn_id.present?

    update!(webauthn_id: SecureRandom.uuid)
    webauthn_id
  end

  # 鍵を登録しているか
  def passkey_enrolled?
    webauthn_credentials.exists?
  end

  # 二要素を使える状態か。**鍵を作っただけでは有効にしない。**
  # 認証アプリに登録し、実際にコードが合うところまで確かめてから立てる。
  # ここを分けないと、登録に失敗した人が締め出される
  def totp_enrolled?
    totp_confirmed_at.present? && totp_secret.present?
  end

  # 登録の始め。まだ有効にしない（confirmed_at は立てない）
  def start_totp_enrollment!
    update!(totp_secret: Auth::Totp.generate_secret, totp_confirmed_at: nil, totp_recovery_codes: [])
    totp_secret
  end

  # コードが合っていれば有効にし、復旧コードを配る。
  # 返すのは**生のコード**で、保存するのはハッシュ。ここでしか見せられない
  def confirm_totp!(code)
    return nil unless totp_secret.present? && Auth::Totp.verify(totp_secret, code)

    codes = self.class.generate_recovery_codes
    update!(totp_confirmed_at: Time.current, totp_recovery_codes: codes.map { |c| self.class.hash_recovery_code(c) })
    codes
  end

  # 復旧コードを配り直す。
  #
  # **配り直した時点で、前のコードはすべて使えなくなる。**
  # 紙に控えたものを失くした・人に見られたかもしれない、というときに
  # 古いものが生き残っていては配り直す意味がない。
  #
  # 認証アプリの鍵は変えない（登録し直させない）。
  def regenerate_recovery_codes!
    return nil unless totp_enrolled?

    codes = self.class.generate_recovery_codes
    update!(totp_recovery_codes: codes.map { |c| self.class.hash_recovery_code(c) })
    codes
  end

  def self.generate_recovery_codes
    Array.new(TOTP_RECOVERY_CODE_COUNT) { SecureRandom.alphanumeric(10).downcase }
  end

  # 認証アプリのコード、または復旧コード。
  # 復旧コードは**使い捨て**（一度使ったら消す）
  def verify_totp(code)
    return false unless totp_enrolled?
    return true if Auth::Totp.verify(totp_secret, code)

    consume_recovery_code(code)
  end

  def consume_recovery_code(code)
    hashed = self.class.hash_recovery_code(code.to_s.strip.downcase)
    remaining = totp_recovery_codes.reject { |stored| ActiveSupport::SecurityUtils.secure_compare(stored.to_s, hashed) }
    return false if remaining.size == totp_recovery_codes.size

    update!(totp_recovery_codes: remaining)
    true
  end

  # 生のまま持たない。漏れたら二要素を回避できてしまう
  def self.hash_recovery_code(code)
    Digest::SHA256.hexdigest("#{code}#{Rails.application.secret_key_base}")
  end

  def self.bootstrap_admin_emails
    ENV.fetch("ADMIN_EMAILS", "").split(",").map { |email| email.strip.downcase }.reject(&:blank?)
  end

  # 実効的に運営権限を持つ人。role だけを見ると、ENV 由来の admin が数から漏れる
  # （管理画面の「運営メンバー」が 0 と出ていた）
  scope :effective_admins, lambda {
    emails = bootstrap_admin_emails
    scope = where(role: %w[support operator admin])
    return scope if emails.empty?

    scope.or(where(confirmed_at: ..Time.current).where("LOWER(email) IN (?)", emails))
  }

  def self.find_for_oauth(auth_hash)
    # provider + uid のみで既存ユーザーを検索
    user = find_by(provider: auth_hash["provider"], uid: auth_hash["uid"])

    if user
      # 既存ユーザーが見つかった場合 → そのまま返す
      user
    else
      # 見つからない場合 → 新規ユーザー作成
      create!(
        email: auth_hash["info"]["email"],
        provider: auth_hash["provider"],
        uid: auth_hash["uid"],
        name: auth_hash.dig("info", "name"),
        password: Devise.friendly_token[0, 20],
        confirmed_at: Time.now
      )
    end
  end

  private

  # クレジット台帳へ1件追記する（残高更新後の値をスナップショットとして残す）。
  def record_credit!(kind:, delta:, subscription: nil, item: nil, space_point_id: nil, stripe_event_id: nil,
                     amount_cents: nil, currency: nil)
    credit_transactions.create!(
      kind:,
      delta:,
      subscription:,
      item:,
      space_point_id:,
      stripe_event_id:,
      # 実際に支払われた金額。返金・売上の計算に要る（付与は支払いを伴わないので nil）
      amount_cents:,
      currency:,
      # テストの決済を売上に混ぜないための目印。支払いを伴わない行は nil のまま
      livemode: amount_cents.nil? ? nil : Billing::Mode.live?,
      subscription_credits_after: subscription_credits,
      topup_credits_after: topup_credits
    )
  end
end
