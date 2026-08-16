# frozen_string_literal: true

module Achievements
  # 「いまいくつか」を数える置き場。
  #
  # 実績もミッションも、条件は結局「ある数がいくつまで届いたか」に落ちる。
  # 数え方だけをここに集め、定義側は種類の名前と目標の数だけを持つ。
  # **条件を1つ増やす＝ここに1行足す**、で済むようにしておく。
  #
  # 知らない種類が来ても落とさない（0 を返す）。定義は運営が画面から作れるので、
  # 打ち間違いで画面ごと落ちるのは割に合わない。
  module Conditions
    module_function

    # 種類 → 数え方。ラベルは管理画面の選択肢に出す
    REGISTRY = {
      "cards_created" => { label: "作ったカードの枚数", count: ->(user) { user.items.count } },
      "images_generated" => {
        label: "作った画像の枚数",
        count: ->(user) { ImageUsage.where(user_id: user.id).count }
      },
      "containers_created" => {
        label: "作ったボックス・キャンバス・スペースの数",
        count: ->(user) { user.boxes.count + user.views.count + user.spaces.count }
      },
      "reviews_total" => {
        label: "カードを見返した回数",
        count: ->(user) { ItemReview.where(user_id: user.id).count }
      },
      "reviews_correct" => {
        label: "正解した回数",
        count: ->(user) { ItemReview.where(user_id: user.id, result: "correct").count }
      },
      "streak_days" => { label: "続いている日数", count: ->(user) { Streak.current(user) } },
      "active_days" => { label: "学習した日数（のべ）", count: ->(user) { Streak.active_days(user) } },
      "rewards_earned" => { label: "獲得した数", count: ->(user) { UserReward.where(user_id: user.id).count } },
      # 自分の絵を決めたか。**0 か 1 しか返さない**（他の条件と同じ「数える」形に合わせる）
      "avatar_set" => {
        label: "自分の絵を決めたか",
        count: ->(user) { user.avatar.attached? ? 1 : 0 }
      },
      # 獲得したものを**実際に出したか**。持っているだけでは 0 のまま。
      #
      # 集めることと使うことは別の行いなので、分けて数える。
      # 星を押して初めて宮殿や名乗りに出るのに、押さないまま気づかない人が多い。
      # 判定は Showcase の持ち方に合わせる（称号=equipped / 宝物=room_placed /
      # それ以外=featured_at）。ここを直に書くと、持ち方が変わったとき片方だけ古くなる
      "title_showcased" => {
        label: "称号を名乗ったか",
        count: ->(user) { Achievements::Showcase.showcased_count(user, "title") }
      },
      "medal_showcased" => {
        label: "勲章を掲げたか",
        count: ->(user) { Achievements::Showcase.showcased_count(user, "medal") }
      },
      "treasure_showcased" => {
        label: "宝物を飾ったか",
        count: ->(user) { Achievements::Showcase.showcased_count(user, "treasure") }
      }
    }.freeze

    # 手動でしか配らないもの（表彰など）に使う。条件では永久に達成しない
    MANUAL = "manual"

    def types
      REGISTRY.keys
    end

    def options
      REGISTRY.map { |key, entry| { value: key, label: entry[:label] } }
    end

    def known?(type)
      REGISTRY.key?(type.to_s)
    end

    # いまの数。知らない種類は 0
    def value_for(type, user)
      entry = REGISTRY[type.to_s]
      return 0 if entry.nil?

      entry[:count].call(user).to_i
    end
  end
end
