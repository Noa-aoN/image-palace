# frozen_string_literal: true

# 一時的なものを片付ける。**体験用の宮殿と、工房室の下見。**
#
# 用途は違うが、片付け方の性質は同じなので、呼ぶ場所を1つにする。
# ただし**数える単位は分けたまま**にする。どちらが増えているのかが
# 分からないと、増えたときに手の打ちようが無い。
#
# ## こまめに呼ぶ
#
# 1宮殿を消すのに約1,900本の問い合わせが要る（カード74枚で実測）。
# 本番の DB は隣の部屋には無いので、まとめて消すと1回が長く走り続ける。
# 1回の量に上限を置き、代わりに何度も回す。
#
# ## 消えるのは寿命が切れたものだけ
#
# 正式な受け取り・公式の原本・共有している絵には触れない。
# `spec/jobs/ephemeral_cleanup_job_spec.rb` がそこを見張っている。
class EphemeralCleanupJob < ApplicationJob
  queue_as :default

  def perform
    demo = Demo::Session.sweep!
    preview = Studio::Preview.sweep!

    if demo.positive? || preview.positive?
      Rails.logger.info "[EphemeralCleanupJob] 体験の宮殿: #{demo} / 下見: #{preview}"
    end

    { demo: demo, preview: preview }
  end
end
