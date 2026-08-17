# frozen_string_literal: true

module Achievements
  # 獲得物の絵の添付を、**1つだけ**に保つ。
  #
  # `has_one_attached` は貼り直せば古いものを捨てる。順番に貼るぶんには重ならない
  # （実測で確認済み）。重なるのは**同時に貼ったとき**で、本番で実際に起きた。
  # 生成の指示が二重に走り、1分違いで2件ぶら下がった獲得物が15件あった。
  #
  # 2件ぶら下がると、`image.blob` は**古いほうを返す**。
  # 作り直したのに古い絵が出続け、しかも `image_key` 列には新しい鍵が入るので、
  # 「鍵は新しいのに絵は古い」という、画面からは気づけない食い違いになる。
  #
  # ここは片付ける側。**貼る順序には手を出さない**
  # （先に消してから作ると、生成が落ちた時に絵の無い獲得物ができる）。
  module RewardImageAttachment
    module_function

    def attachments_for(reward)
      ActiveStorage::Attachment
        .where(record_type: "RewardDefinition", record_id: reward.id, name: "image")
        .order(:id)
    end

    # 残すべき添付。
    #
    # **`image_key` 列を正とする。** あれは貼った直後に書いた「いま指すべき絵」で、
    # 作り直すたびに更新される。列と一致する添付があれば、それが最新。
    # 一致するものが無ければ（列が空・手で消された等）、いちばん後に貼ったものを残す。
    def keeper(reward)
      rows = attachments_for(reward).to_a
      return nil if rows.empty?

      by_key = reward.image_key.presence && rows.find { |a| a.blob.key == reward.image_key }
      by_key || rows.last
    end

    # 残す1件以外の添付。**共有されている絵は含めない**
    # （他の獲得物やプランが同じ絵を指していたら、消すと向こうが壊れる）
    def extras(reward)
      keep = keeper(reward)
      return [] if keep.nil?

      attachments_for(reward).reject { |a| a.id == keep.id }.reject { |a| shared_blob?(a) }
    end

    # その絵を、他の添付も指しているか
    def shared_blob?(attachment)
      ActiveStorage::Attachment.where(blob_id: attachment.blob_id).where.not(id: attachment.id).exists?
    end

    # 余分な添付を片付ける。片付けた数を返す。
    #
    # `purge_later` ではなく `purge` を使う。**片付いたことをその場で確かめたい**ため。
    # 後回しにすると、行が残っている間は `image.blob` が古いほうを返し続ける
    # （まさにこの不具合そのもの）。絵は多くて数十枚なので、待って困る量ではない。
    def prune_extras!(reward)
      rows = extras(reward)
      rows.each(&:purge)
      rows.size
    end

    # 添付が2件以上ぶら下がっている獲得物
    def duplicated
      ids = ActiveStorage::Attachment
            .where(record_type: "RewardDefinition", name: "image")
            .group(:record_id).having("COUNT(*) > 1").pluck(:record_id)
      RewardDefinition.where(id: ids).order(:position, :created_at)
    end
  end
end
