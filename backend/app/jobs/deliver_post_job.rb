# frozen_string_literal: true

# 読みものをお知らせとして全員に届けるジョブ。
#
# 人数分の通知を作るので、一度に全部を組み立てるとメモリも DB も詰まる。
# 少しずつ挿していく。
#
# 途中で落ちても、同じ人に二重に届かないよう、既に届いている人は飛ばす。
class DeliverPostJob < ApplicationJob
  queue_as :default

  BATCH_SIZE = 500

  def perform(post_id)
    post = Post.find_by(id: post_id)
    return if post.nil? || !post.published?

    url = "/blog/#{post.slug}"
    delivered = 0

    User.where.not(confirmed_at: nil).find_in_batches(batch_size: BATCH_SIZE) do |users|
      rows = users.filter_map do |user|
        next if already_delivered?(user, post)

        {
          user_id: user.id,
          kind: "announcement",
          title: post.title,
          body: post.excerpt,
          url: url,
          payload: { "post_slug" => post.slug, "category" => post.category },
          created_at: Time.current,
          updated_at: Time.current
        }
      end
      next if rows.empty?

      Notification.insert_all(rows)
      delivered += rows.size
    end

    Rails.logger.info "[DeliverPostJob] DELIVERED post=#{post.slug} count=#{delivered}"
  end

  private

  def already_delivered?(user, post)
    user.notifications.where(kind: "announcement")
        .where("payload->>'post_slug' = ?", post.slug)
        .exists?
  end
end
