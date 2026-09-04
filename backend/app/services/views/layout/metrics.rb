# frozen_string_literal: true

module Views
  module Layout
    # カードの寸法と、盤の決めごと。
    #
    # 座標を決める仕事は、これまで AI と `AiEditService` に分かれていた。
    # AI に「20の倍数に丸めて」「x か y を揃えて」と守らせたものを、
    # あとから走る押しのけが崩す——という形になっていた。
    #
    # 配置をコード側の1か所に寄せるにあたり、**寸法の決めごとをここへ集める**。
    # レイアウトも、押しのけも、線の経路も、同じ数字を見て動く。
    module Metrics
      module_function

      # カードの既定の大きさ（フロントの CARD_DEFAULT_W / H と合わせること）。
      # 高さは 幅 + 見出しの行(32) で、画像の領域が正方形になるようにしてある
      CARD_WIDTH = 144
      CARD_HEIGHT = 176
      DEFAULT_CARD_FONT_SIZE = 15

      # 選べるカードの大きさの範囲（読めなくなる／画面を覆うのを防ぐ）
      MIN_CARD_SIZE = 80
      MAX_CARD_SIZE = 480

      # 盤の端にも余白を残す。カードが端に張り付くと、収めたあとも窮屈に見える
      BOARD_PADDING = 96

      # カードどうしの最低の隙間。
      # 線の助走（両端で 28 ずつ）と、線の上に載る文字の居場所を通す
      MIN_CARD_GAP = 140

      # 長い見出しは、実カード幅だけで間隔を決めると詰まって見える。
      # おおよその文字幅を「読みやすさに必要な幅」として配置計算に含める
      CARD_TITLE_HORIZONTAL_PADDING = 32
      MAX_TITLE_FOOTPRINT_WIDTH = 320

      # 盤の最小の大きさ。**これは下限であって上限ではない。**
      #
      # 固定だった頃は、この中へ押し込めようとして 33枚目から破綻していた
      # （必要中心間距離から逆算すると 8列×4行＝約32枚で頭打ちになる）。
      # いまは足りなければ広げる。React Flow の面は無限で、
      # 開いたときに全体が入るよう収める（fitView）ので、広げても表示は壊れない
      MIN_BOARD_WIDTH = 2400
      MIN_BOARD_HEIGHT = 1600

      # 見出しの文字幅を概算する。
      #
      # ブラウザの実測値はサーバから取れないので、
      # 全角を1文字、半角を約0.58文字、空白を0.35文字として見積もる。
      # **カード自体を勝手に大きくはしない。** 配置の間隔としてだけ使う
      def title_footprint_width(title, font_size: DEFAULT_CARD_FONT_SIZE)
        size = font_size.to_f
        size = DEFAULT_CARD_FONT_SIZE unless size.positive?
        size = size.clamp(10, 32)

        (text_units(title) * size + CARD_TITLE_HORIZONTAL_PADDING)
          .clamp(CARD_WIDTH, MAX_TITLE_FOOTPRINT_WIDTH)
      end

      # 文字が横に占める量を、文字の大きさ1に対する比で見積もる。
      #
      # ブラウザに測らせられないので、幅の違う3種で分ける。
      # 全角は1、英数は0.58、空白は0.35。**線の上の文字もこれで測る**
      # （見出しと同じ物差しでないと、片方だけずれる）
      def text_units(text)
        text.to_s.each_char.sum do |character|
          if character.match?(/\s/)
            0.35
          elsif character.ascii_only?
            0.58
          else
            1.0
          end
        end
      end

      # 盤の設定から見出しの文字サイズを取り出す
      def font_size_for(view)
        view.settings.to_h["card_font_size"]
      end

      # 大きさを、読める範囲へ収める。指定が無ければ既定へ戻す
      def card_size(value, fallback)
        return fallback if value.blank?

        value.to_f.clamp(MIN_CARD_SIZE, MAX_CARD_SIZE).round
      end
    end
  end
end
