module Notifications
  # 運営からのお知らせを全ユーザーへ配る（ユーザーごとに1行ずつ作る fan-out 方式）。
  # 管理画面は無いので lib/tasks/notifications.rake から呼び出す想定。
  class BroadcastService
    BATCH_SIZE = 1000

    def self.call(title:, body: nil, url: nil)
      new(title:, body:, url:).call
    end

    def initialize(title:, body: nil, url: nil)
      @title = title
      @body = body
      @url = url
    end

    # 作成した通知の件数を返す。
    def call
      raise ArgumentError, "title は必須です" if @title.blank?

      now = Time.current
      created = 0

      User.select(:id).find_in_batches(batch_size: BATCH_SIZE) do |users|
        rows = users.map do |user|
          {
            user_id: user.id,
            kind: "announcement",
            title: @title,
            body: @body,
            url: @url,
            payload: {},
            created_at: now,
            updated_at: now
          }
        end

        Notification.insert_all!(rows)
        created += rows.size
      end

      created
    end
  end
end
