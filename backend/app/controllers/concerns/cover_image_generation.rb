# frozen_string_literal: true

# カバー画像を AI で作る共通処理（キャンバス／スペース／ボックス）。
#
# カバーはこれまで「先頭カード / コラージュ / 自分でアップロード」の3択で、
# 中身がまだ無いものには見せられる絵が無かった。プロフィールアイコンと同じように
# ことばから作れるようにする。
#
# 画像を作る＝クレジットを使うので、アバターと同じく
#   モデレーション → 残高確認 → 前払い消費 → 非同期生成
# の順にする（作ってから足りないと分かる、を避ける）。
module CoverImageGeneration
  extend ActiveSupport::Concern

  MAX_COVER_PROMPT = 300

  private

  # record: カバーを持つレコード。ブロックには生成受付後のレコードを渡す
  def generate_cover_for(record)
    prompt = params.dig(:cover, :prompt).to_s.strip
    style = params.dig(:cover, :style).to_s.presence

    return render_cover_error("プロンプトを入力してください。") if prompt.blank?
    if prompt.length > MAX_COVER_PROMPT
      return render_cover_error("プロンプトが長すぎます（#{MAX_COVER_PROMPT}文字以内）。")
    end
    return render_cover_error("すでに生成中です。") if record.cover_generating?

    return render_cover_error(cover_moderation_message) if cover_prompt_blocked?(prompt)

    current_user.ensure_current_period_credits!
    cost = ::Billing::CreditCost.call(kind: :cover)

    current_user.with_lock do
      raise User::InsufficientCredits unless current_user.can_afford?(cost)

      current_user.consume_credits!(cost)
      record.update_cover_generation_status!("pending")
    end

    GenerateCoverImageJob.perform_later(record, prompt, style)
    yield record.reload
  rescue User::InsufficientCredits
    render_cover_error("クレジットが不足しています")
  end

  def cover_prompt_blocked?(prompt)
    result = Moderation::PromptModerator.call(prompt)
    return false if result.allowed?

    Rails.logger.warn(
      "[Moderation] BLOCKED cover user_id=#{current_user.id} category=#{result.category} term=#{result.term}"
    )
    true
  end

  def cover_moderation_message
    "入力に利用できない表現が含まれています。別の語でお試しください。"
  end

  def render_cover_error(message)
    render json: { error: message }, status: :unprocessable_entity
  end
end
