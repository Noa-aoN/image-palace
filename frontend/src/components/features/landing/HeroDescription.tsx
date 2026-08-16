/**
 * LP ヒーローの説明文。**文言をここ1か所に置く**。
 *
 * 見せ方（紙を敷くか／縁取りにするか）は変わりうるが、文言は同じ。
 * 別々に持つと、片方だけ直したときに検討用ページと本番がずれる。
 *
 * 見え方の案は `/dev/hero-text` で並べて比べられる。
 */

/**
 * - `panel`   … 半透明の白い紙を敷く（現行）。いちばん読みやすいが、背景を覆う
 * - `outline` … 紙を敷かず、濃い文字に細い白縁。背景を覆わないが、
 *               白い石畳のような明るい場所では縁が効きにくい
 * - `soft`    … 縁取り＋ごく薄い紙。両者の折衷
 */
export type HeroDescriptionVariant = 'panel' | 'outline' | 'soft'

const PANEL_STYLE: Record<HeroDescriptionVariant, React.CSSProperties> = {
  panel: {
    background: 'var(--landing-panel-bg)',
    border: '1px solid var(--landing-panel-border)',
    borderRadius: 'var(--landing-panel-radius)',
  },
  outline: {},
  soft: {
    // 縁取りで読ませるので、紙は「わずかに沈める」だけでよい。
    // 縁線は引かない（線を引いた時点で、面積の話が戻ってくる）
    background: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 'var(--landing-panel-radius)',
  },
}

export function HeroDescription({
  variant = 'panel',
  className = '',
}: {
  variant?: HeroDescriptionVariant
  className?: string
}) {
  const outlined = variant !== 'panel'

  return (
    <div
      // 幅は「1行の字数」で決める。日本語は40字前後を超えると、
      // 行の終わりから次の行の頭へ目を戻すのが億劫になる。
      // 広い画面で 2xl（672px）＝本文16pxでおよそ40字。ここが上限で、
      // これ以上広げると読みやすさより先に、背景の宮殿が隠れる
      className={`max-w-lg text-center sm:max-w-xl md:max-w-2xl ${
        // 紙を敷かないなら内側の余白は要らない（余白は紙のためのもの）。
        // わずかに残すのは、縁取りが隣の要素に触れないぶんだけ
        variant === 'panel'
          ? 'px-6 py-4 shadow-sm backdrop-blur-sm md:px-8 md:py-6'
          : variant === 'soft'
            ? 'px-5 py-3 backdrop-blur-[1px] md:px-6 md:py-4'
            : 'px-2 py-1'
      } ${className}`}
      style={PANEL_STYLE[variant]}
    >
      {/* 3段構え。**何ができるか → どう使えるか → 続けると何になるか**。
          順番を入れ替えない。使い道から始めると、何を作る話なのか分からないまま
          用途だけが並ぶ。

          **一文ごとに改行する**（句点で切る）。中央寄せの文は、行の切れ目が
          文の切れ目と揃っていないと、どこまでが一続きなのかを目で追い直すことになる。

          1文目は句点まで44字あって、紙を上限まで広げても1行に入らない。
          成り行きに任せると読点の無いところで切れるので、
          **読点（「〜生成して、」の後）で自分で折る**。
          text-balance は、さらに狭い画面でそれでも折り返すときに、
          行の長さを揃えて中央の座りを保つため */}
      <p
        className={`text-[0.9rem] leading-relaxed text-balance md:text-lg ${outlined ? 'hero-outline' : ''}`}
        style={outlined ? undefined : { color: 'var(--foreground)' }}
      >
        {/* 鉤括弧は前の行の末尾に置く。次の行の頭に置くと、そこまでが
            ひとつのテキストになり、JSX が改行を空白1つに変えて
            「した 「記憶のカード」」と空いてしまう */}
        覚えたい・残したい言葉を書くと、AIがイメージを生成して、
        <br />
        「<strong className="font-semibold">記憶のカード</strong>」を作ってくれます。
      </p>
      {/* 用途は**それぞれを太字にする**。文のまま流すと、
          読み飛ばした人に「単語帳のサービス」としてだけ残る。
          名詞だけを立てて、拾い読みでも用途の広さが目に入るようにする */}
      <p
        className={`mt-3 text-[0.85rem] leading-relaxed text-balance md:text-base ${
          // 縁取り版では字を薄くしない。薄い字に白縁を付けると、
          // 縁のほうが濃くなって字が抜けて見える
          outlined ? 'hero-outline' : ''
        }`}
        style={outlined ? undefined : { color: '#5A5348' }}
      >
        <strong className="font-semibold">単語帳</strong>や
        <strong className="font-semibold">用語集</strong>での暗記、
        <strong className="font-semibold">図鑑</strong>・
        <strong className="font-semibold">相関図</strong>・
        <strong className="font-semibold">年表</strong>づくり。
        <br />
        <strong className="font-semibold">絵日記</strong>、
        <strong className="font-semibold">タスク管理</strong>、
        <strong className="font-semibold">ビジョンボード</strong>など、使い方は無限大。
      </p>
      <p
        className={`mt-3 text-[0.85rem] leading-relaxed text-balance md:text-base ${outlined ? 'hero-outline' : ''}`}
        style={outlined ? undefined : { color: '#5A5348' }}
      >
        {/* 句点で切る。ここも1文ずつ。
            文の途中で行を折ると JSX が改行を空白1つに変えてしまうので、
            折ってよいのは <br /> を挟む場所だけ */}
        作ったカードは、自分の「宮殿」に並べて、整理・組み合わせ・反復練習。
        <br />
        {/* 「記憶のカード」と対になる呼び名なので、同じ太さで置く。
            鉤括弧は前の行の末尾に（次の行の頭だと空白が1つ入る） */}
        それが自分だけの「
        <strong className="font-semibold">記憶の宮殿</strong>」になっていきます。
      </p>
    </div>
  )
}
