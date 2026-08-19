# ユーザーの文字列が OpenAI へ渡る手前で検査する。
#
# 検査は `Moderation::PromptModerator`（ブロックリスト → OpenAI Moderation API）。
# ここはその**呼び出し口**を1つに揃えるためのもの。
#
# 同じ検査が控えめに4箇所へ散っていて、**入口ごとに掛け忘れ**が出ていた。
# 作成時は検査するのに更新時はしない、という抜けが実際に2つあった。
module PromptModeration
  extend ActiveSupport::Concern

  class Blocked < StandardError; end

  MESSAGE = "入力に利用できない表現が含まれています。別の表現でお試しください。".freeze

  included do
    rescue_from Blocked, with: :render_prompt_blocked
  end

  private

  # 検査して、駄目なら止める。
  #
  # `as` は「どの入口か」。監査ログにそのまま出す。
  # どこから入ってきたかが分からないと、誤検知の調べようがない。
  def moderate_prompt!(text, as:)
    return if text.blank?

    result = Moderation::PromptModerator.call(text)
    return if result.allowed?

    Rails.logger.warn(
      "[Moderation] BLOCKED field=#{as} user_id=#{current_user&.id} " \
      "category=#{result.category} term=#{result.term}"
    )
    raise Blocked
  end

  def render_prompt_blocked
    render json: { error: MESSAGE }, status: :unprocessable_entity
  end
end
