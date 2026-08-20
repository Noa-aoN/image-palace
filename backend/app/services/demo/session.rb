# frozen_string_literal: true

module Demo
  # 体験用の宮殿を、その場で建てる。
  #
  #   Demo::Session.call(resume_token: token)
  #
  # ## 使い捨てにする理由
  #
  # 1つの口座を大勢で共有すると、10人で壊れる。
  # devise_token_auth は端末を10までしか覚えないので、11人目が入った瞬間、
  # 最初の人が**黙って締め出される**。ログイン自体も 10回/20秒/1IP で絞ってあり、
  # 教室で一斉に押すと3人目から弾かれる。
  #
  # 使い捨てなら、そのどちらも起きない。
  #
  # ## 消えても困らない
  #
  # 中身は毎回まったく同じ完成状態で、編集は持ち帰らない。
  # だから寿命が切れても、**もう一度押せば同じ宮殿がまた建つ**。
  class Session
    class Error < StandardError; end
    # いまは新しく作れない（混みすぎ・止めている）
    class Unavailable < Error; end

    # 作ってから消えるまで。
    #
    # **最後に触ってから、にはしない。** 正確に取るには手が要るし
    # （`last_seen_at` は1日1回しか動かない）、
    # 消えても押し直せば同じものが建つので、規則は1つで足りる
    LIFETIME = 24.hours

    # 1日に建てられる数。想定（数十〜100人）の5倍
    DAILY_CAP = 500
    # 同時に立っていられる数。届いたら異常
    CONCURRENT_CAP = 300

    # 配る中身は、**届け先が「体験」の荷物を全部**。
    #
    # 1つの荷物に固定していたころは、中身を変えるのに
    # 荷物ごと作り直すことになった。届け先で選ぶようにすると、
    # 工房室で「IT を外す」「神話を足す」がその場でできる。
    #
    # `demo_showcase` という鍵はもう特別扱いしない
    # 体験の記念に1つだけ渡す
    MEDAL_KEY = "medal_first_visit"

    # 署名の用途。ほかの署名と取り違えないよう、名前で分ける
    RESUME_PURPOSE = "demo_resume"

    Result = Struct.new(:user, :created, :package, keyword_init: true) do
      def reused? = !created
    end

    def self.call(...)
      new(...).call
    end

    # また戻ってくるための合鍵。**署名付きなので、他人の宮殿を指すものは作れない**
    def self.resume_token_for(user)
      Rails.application.message_verifier(RESUME_PURPOSE).generate(user.id, expires_in: LIFETIME)
    end

    # 合鍵から口座を引く。偽物・期限切れは黙って nil（新しく建てるだけ）
    def self.user_from_resume_token(token)
      return nil if token.blank?

      id = Rails.application.message_verifier(RESUME_PURPOSE).verified(token)
      id.presence
    end

    # @param resume_token [String, nil] 画面が持っている合鍵
    # @param viewer [User, nil] いま名乗っている人。**準備中でも入れるかの判断に使う**
    def initialize(resume_token: nil, viewer: nil)
      @resume_token = resume_token
      @viewer = viewer
    end

    # 入口が開いているか。**画面の出し分けは守りではない**ので、ここでも見る
    def self.open?
      FeatureFlag.stages["demo_entry"] == "released"
    end

    # 準備中でも入れる人。
    #
    # **確かめられないまま開くことになるのを避ける。**
    # 制作の権限を持つ人だけが、閉じている間も中を見られる。
    # 一般の人は今までどおり断られる（入口は認証が要らないので、
    # 名乗らない相手はここに来ない）。
    def self.open_for?(user)
      open? || user&.can_access_official_studio? || false
    end

    def call
      unless self.class.open_for?(@viewer)
        raise Unavailable, "体験版は現在準備中です"
      end

      reused = find_living(self.class.user_from_resume_token(@resume_token))
      return Result.new(user: reused, created: false, package: nil) if reused

      ensure_capacity!
      build!
    end

    # 寿命切れを片付ける。**1時間おきに呼ぶ**ので、1回の量が小さく保たれる
    def self.sweep!(now: Time.current)
      expired = User.demo_accounts.where(created_at: ...(now - LIFETIME))
      count = expired.count
      expired.find_each(&:destroy!)
      count
    end

    private

    def find_living(id)
      return nil if id.blank?

      User.demo_accounts.where(created_at: (Time.current - LIFETIME)..).find_by(id: id)
    end

    # **数は DB で数える。** Rack::Attack の絞りはプロセスごとに別勘定で、
    # 再起動すると消えるので、上限としては当てにできない
    def ensure_capacity!
      today = User.demo_accounts.where(created_at: Time.current.beginning_of_day..).count
      raise Unavailable, "いまは混み合っています。しばらくしてからお試しください" if today >= DAILY_CAP

      living = User.demo_accounts.where(created_at: (Time.current - LIFETIME)..).count
      raise Unavailable, "いまは混み合っています。しばらくしてからお試しください" if living >= CONCURRENT_CAP
    end

    # 体験の宮殿に置くもの。**届け先が「体験」で、いま配れるもの**
    def self.packages
      ContentDelivery.packages_for("demo")
    end

    def build!
      packages = self.class.packages
      raise Unavailable, "体験用の宮殿がまだ用意されていません" if packages.empty?

      user = create_user!
      # **順に入れる。** 同じカードが2つの荷物に入っていても、2枚にはならない
      # （`Distributor` が既に持っているものを使い回す）
      packages.each do |package|
        ContentPackages::Distributor.call(user: user, package: package, source: "demo_signup")
      end
      grant_medal(user)

      Result.new(user: user, created: true, package: packages.first)
    end

    def create_user!
      password = SecureRandom.urlsafe_base64(32)
      User.create!(
        email: "demo-#{SecureRandom.hex(8)}@#{User::DEMO_EMAIL_DOMAIN}",
        password: password, password_confirmation: password,
        # 確認のメールは送れないし、送る相手も居ない
        confirmed_at: Time.current,
        name: "はじまりの旅人"
      ).tap { |u| prepare_settings(u) }
    end

    # 案内をもう一度出さない。**入った瞬間から、育った宮殿がそこにある**
    def prepare_settings(user)
      setting = user.setting || user.build_setting
      setting.onboarded_at = Time.current
      setting.palace_name = "はじまりの宮殿"
      setting.save!
    end

    # 体験の記念。**報酬のクレジットは配らない**
    # （見本のカードがあるだけで、いくつかの実績は正直に解けてしまう）
    def grant_medal(user)
      reward = RewardDefinition.from_registry(MEDAL_KEY)
      return if reward.nil?

      Achievements::Granter.grant(user: user, reward: reward, source: "demo", notify: false)
    rescue StandardError => e
      # 記念が配れなくても、宮殿は開く
      Rails.logger.warn "[Demo::Session] 記念を渡せませんでした: #{e.class}: #{e.message}"
    end
  end
end
