module Notifications
  # 通知を1件作る。ただし、同じユーザー・同じ種別の未読通知が直近 AGGREGATE_WINDOW 以内にあれば、
  # 新しい行を増やさず既存の1件にまとめる（payload["count"] を加算する）。
  # 一括作成で100枚生成しても通知が100件に膨れないようにするための集約。
  class CreateService
    AGGREGATE_WINDOW = 10.minutes

    # まとめる対象の種別。運営お知らせ（announcement）は1件ずつ独立して残す。
    AGGREGATABLE_KINDS = %w[item_generation_completed item_generation_failed].freeze

    def self.call(user:, kind:, title:, body: nil, url: nil, payload: {})
      new(user:, kind:, title:, body:, url:, payload:).call
    end

    def initialize(user:, kind:, title:, body: nil, url: nil, payload: {})
      @user = user
      @kind = kind.to_s
      @title = title
      @body = body
      @url = url
      @payload = payload.stringify_keys
    end

    def call
      return create_new unless AGGREGATABLE_KINDS.include?(@kind)

      # 並行して走るジョブ同士が同じ通知を二重に作らないよう、ユーザー単位で直列化する。
      @user.with_lock do
        existing = aggregatable_notification
        existing ? aggregate_into(existing) : create_new
      end
    end

    private

    def aggregatable_notification
      @user.notifications
           .unread
           .where(kind: @kind)
           .where(created_at: AGGREGATE_WINDOW.ago..)
           .recent
           .first
    end

    def create_new
      @user.notifications.create!(
        kind: @kind,
        title: @title,
        body: @body,
        url: @url,
        payload: @payload.merge("count" => 1)
      )
    end

    # まとまった通知は「何件目か」が分かるタイトルに差し替え、最新の1件へリンクし直す。
    # created_at も更新して、一覧の先頭に上がるようにする。
    def aggregate_into(notification)
      count = notification.payload.fetch("count", 1).to_i + 1

      notification.update!(
        title: aggregated_title(count),
        body: @body,
        url: @url,
        payload: notification.payload.merge(@payload).merge("count" => count),
        created_at: Time.current
      )
      notification
    end

    def aggregated_title(count)
      case @kind
      when "item_generation_completed" then "カード#{count}件の画像生成が完了しました"
      when "item_generation_failed"    then "カード#{count}件の画像生成に失敗しました"
      else @title
      end
    end
  end
end
