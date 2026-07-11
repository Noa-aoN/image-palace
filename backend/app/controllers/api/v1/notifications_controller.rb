module Api
  module V1
    # お知らせ（生成結果・運営からの通知など）
    class NotificationsController < BaseController
      DEFAULT_PER_PAGE = 20
      MAX_PER_PAGE = 50

      def index
        scope = current_user.notifications.recent
        total = scope.count
        notifications = scope.limit(pagination_per).offset((pagination_page - 1) * pagination_per)

        render json: {
          notifications: notifications.map { |n| serialize_notification(n) },
          unread_count: current_user.notifications.unread.count,
          meta: {
            page: pagination_page,
            per: pagination_per,
            total_count: total,
            total_pages: (total.to_f / pagination_per).ceil
          }
        }
      end

      # 未読バッジ用の軽量エンドポイント（ヘッダーから定期的に叩く）
      def unread_count
        render json: { unread_count: current_user.notifications.unread.count }
      end

      def read
        notification = current_user.notifications.find(params[:id])
        notification.mark_read!
        render json: serialize_notification(notification)
      end

      def read_all
        current_user.notifications.unread.update_all(read_at: Time.current, updated_at: Time.current)
        render json: { unread_count: 0 }
      end

      private

      def serialize_notification(notification)
        {
          id: notification.id,
          kind: notification.kind,
          title: notification.title,
          body: notification.body,
          url: notification.url,
          payload: notification.payload,
          read: notification.read?,
          created_at: notification.created_at
        }
      end

      # 1始まり。不正値・0以下は 1 に丸める
      def pagination_page
        page = params[:page].to_i
        page < 1 ? 1 : page
      end

      # 1〜MAX_PER_PAGE にクランプ。未指定・不正値は DEFAULT_PER_PAGE
      def pagination_per
        per = params[:per].to_i
        return DEFAULT_PER_PAGE if per < 1

        [ per, MAX_PER_PAGE ].min
      end
    end
  end
end
