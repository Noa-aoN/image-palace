# frozen_string_literal: true

# アイテムのタイトル・スタイル・カスタム指示から、画像生成に渡す「有効プロンプト」を組み立てる。
# 有効プロンプトは画像生成だけでなくキャッシュキー（normalized_prompt）の元にもなるため、
# スタイル/カスタムが異なれば別画像としてキャッシュされる。
class PromptBuilderService
  # スタイルプリセット → 画像生成プロンプトに付与する英語の修飾句
  STYLE_MODIFIERS = {
    "illustration" => "in a clean, flat vector illustration style",
    "photo" => "as a realistic, high-quality photograph",
    "watercolor" => "in a soft watercolor painting style",
    "anime" => "in a Japanese anime art style",
    "3d" => "as a polished 3D rendered image",
    "pixel" => "in retro pixel art style",
    "sketch" => "as a hand-drawn pencil sketch"
  }.freeze

  STYLES = STYLE_MODIFIERS.keys.freeze
  CUSTOM_PROMPT_MAX_LENGTH = 300

  def self.effective_prompt(item)
    parts = [ item.title.to_s.strip ]

    modifier = STYLE_MODIFIERS[item.style.presence]
    parts << modifier if modifier

    custom = item.custom_prompt.to_s.strip
    parts << custom if custom.present?

    parts.join(", ")
  end
end
