# frozen_string_literal: true

module Ephemeral
  # 使い捨てのものを消す前に、**分け合っている絵の紐だけ先に外す。**
  #
  # ## なぜ要るか
  #
  # 体験の宮殿も工房室の下見も、絵は荷物から複製したもので、
  # 実体（blob）は原本と分け合っている。**新しく作られた絵は1枚も無い。**
  #
  # そのまま消すと、Rails は紐を1本ずつ外し、そのたびに
  # 「実体も消してよいか」を確かめる仕事を積む。実際には他に持ち主が
  # 居るので外部キーに守られて消えないのだが、**確かめる仕事だけが残る。**
  #
  # カード30枚の宮殿で、紐の後始末に 67本の問い合わせと 30本の仕事が積まれていた
  # （片付け全体 809本の 16%）。宮殿が300あれば、9,000本の無駄な仕事になる。
  #
  # ## 消す範囲を、必ずカードで区切る
  #
  # **アカウントで区切ってはいけない。**
  # 公式のアカウントが自分の荷物を下見すると、複製と原本が同じアカウントに並ぶ。
  # アカウントで区切ると、原本の紐まで「他に持ち主が居る」ことになって外れてしまう。
  #
  # 消してよいのは、いま消そうとしているカードの紐だけ。
  #
  # ## 何を外すか
  #
  # **他に持ち主が居る紐だけ。** そのカードだけが持っている絵は、
  # これまでどおり普通に消す（実体も消えてよい）。
  #
  # 消しているのは紐（`active_storage_attachments`）だけで、実体には触れない。
  class SharedImages
    # @param item_ids [Array<String>, ActiveRecord::Relation] これから消すカード
    # @return [Integer] 外した紐の本数
    def self.detach!(item_ids)
      new(item_ids).detach!
    end

    def initialize(item_ids)
      @item_ids = item_ids
    end

    def detach!
      return 0 if media_ids.empty?

      mine = ActiveStorage::Attachment.where(record_type: "Media", record_id: media_ids)
      mine.where(blob_id: others.select(:blob_id)).delete_all
    end

    private

    def media_ids
      @media_ids ||= Media.where(item_id: @item_ids).pluck(:id)
    end

    # **これから消すカード以外**が持っている紐。
    # ここに同じ実体があれば、外しても絵は残る
    def others
      ActiveStorage::Attachment.where.not(record_type: "Media", record_id: media_ids)
    end
  end
end
