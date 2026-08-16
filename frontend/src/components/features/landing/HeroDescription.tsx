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
 * - `wash`    … 細い白縁＋**縁のない白い靄**。面ではなく光の溜まりとして敷くので、
 *               紙があると気づかれないまま字だけが読みやすくなる（本番候補）
 * - `plain`   … **地を一切足さない**。濃い文字をそのまま置く（本番採用）。
 *               ヒーローのスクリムの形を直したことで、追加の地なしで AA を通るようになった
 *               （帯の最小 5.31:1）。実測は globals.css の `.hero-scrim` の注記を見ること
 * - `softWash`  … **白い靄＋濃い文字**（本番採用）。縁取りも影も付けない。
 *               靄は縁を作らず外へ消すので、境界が出ない
 * - `ivory`     … やや暖色のアイボリー文字＋ごく弱い濃茶の影＋文字の後ろだけ暗くする soft scrim。
 *               境界は作らない。**要る暗さは実測で65%**（それ未満だと地に埋もれる）
 * - `white`      … 白文字＋にじむ影だけ。いちばん単純
 * - `whiteWash`  … 白文字＋**縁のない黒い靄**。wash の明暗を反転したもの
 *
 * 白文字系は、本番ヒーローのアイボリースクリム（上端88%）と相性が悪い。
 * 説明文が置かれる高さは地がほぼアイボリーなので、そこでは白字が消える。
 * 採るならスクリムのほうを弱める必要がある（`/dev/hero-text` で見比べられる）。
 */
export type HeroDescriptionVariant = 'plain' | 'panel' | 'outline' | 'wash' | 'softWash' | 'white' | 'whiteWash' | 'ivory'

export function HeroDescription({
  variant = 'panel',
  className = '',
  washOpacity,
  whiteShadow,
  underlineStrong = false,
}: {
  variant?: HeroDescriptionVariant
  className?: string
  /** `wash` の白の濃さ。既定は globals.css の `--hero-wash-a`（検討用に外から振る） */
  washOpacity?: number
  /** 白文字版の影の濃さ。既定は globals.css の `--white-shadow-a` */
  whiteShadow?: number
  /** 太字に金の下線を引く（検討中。外すのはこの1語） */
  underlineStrong?: boolean
}) {
  // 白文字系は影で読ませる。縁取り（hero-outline）は使わない
  const white = variant === 'white' || variant === 'whiteWash'
  const ivory = variant === 'ivory'
  const outlined = variant === 'outline' || variant === 'wash'
  const softWash = variant === 'softWash'
  // 字の色を CSS 側に任せる版（インラインの色指定を外す）
  const styled = !white && !outlined && !ivory
  const textClass = ivory ? 'hero-ivory' : white ? 'hero-white' : outlined ? 'hero-outline' : ''

  return (
    <div
      // 幅は「1行の字数」で決める。日本語は40字前後を超えると、
      // 行の終わりから次の行の頭へ目を戻すのが億劫になる。
      // 広い画面で 2xl（672px）＝本文16pxでおよそ40字。ここが上限で、
      // これ以上広げると読みやすさより先に、背景の宮殿が隠れる
      className={`relative isolate max-w-lg text-center sm:max-w-xl md:max-w-2xl lg:max-w-4xl ${
        underlineStrong ? 'hero-desc-underline ' : ''
      }${
        // 紙を敷かないなら内側の余白は要らない（余白は紙のためのもの）。
        // wash は靄そのものが文字の外へはみ出すので、ここでは足さない
        variant === 'panel' ? 'px-6 py-4 shadow-sm backdrop-blur-sm md:px-8 md:py-6' : 'px-2 py-1'
      } ${className}`}
      style={
        variant === 'panel'
          ? {
              background: 'var(--landing-panel-bg)',
              border: '1px solid var(--landing-panel-border)',
              borderRadius: 'var(--landing-panel-radius)',
            }
          : whiteShadow === undefined
            ? undefined
            : ({ '--white-shadow-a': whiteShadow } as React.CSSProperties)
      }
    >
      {/* 靄は**文字と別の層**に置く。同じ層でマスクすると、端の字まで薄くなる */}
      {(variant === 'wash' || variant === 'whiteWash' || ivory || softWash) && (
        <span
          aria-hidden
          className={`hero-wash${variant === 'whiteWash' ? ' hero-wash--dark' : ''}${ivory ? ' hero-wash--warm' : ''}`}
          style={washOpacity === undefined ? undefined : ({ '--hero-wash-a': washOpacity } as React.CSSProperties)}
        />
      )}
      {/* 文字は靄より前面へ。ここで前後を確定させないと、
          絶対配置の靄が通常フローの段落に覆いかぶさる */}
      <div className="relative z-10">
      {/* 3段構え。**何ができるか → どう使えるか → 続けると何になるか**。
          順番を入れ替えない。使い道から始めると、何を作る話なのか分からないまま
          用途だけが並ぶ。

          **一文ごとに改行する**（句点で切る）。中央寄せの文は、行の切れ目が
          文の切れ目と揃っていないと、どこまでが一続きなのかを目で追い直すことになる。

          1文目（44字）は広い画面で1行に収める。紙を捨てたので幅を広げても
          覆う量は増えず、**幅が「ただ」になった**（実測: 中央55%→62%で最小 5.31→5.39）。
          text-balance は、狭い画面で折り返すときに行の長さを揃えて
          中央の座りを保つため */}
      <p
        className={`text-[0.85rem] leading-relaxed text-balance md:text-[1.0625rem] ${textClass}`}
        style={styled ? { color: 'var(--foreground)' } : undefined}
      >
        {/* 鉤括弧は前の行の末尾に置く。次の行の頭に置くと、そこまでが
            ひとつのテキストになり、JSX が改行を空白1つに変えて
            「した 「記憶のカード」」と空いてしまう */}
        {/* ここは折らない。広い画面では1行に収める（そのぶん幅を取る）。
            紙を捨てたので、幅を広げても覆う量は増えない ── 幅が「ただ」になった */}
        覚えたい・残したい言葉を書くと、AIがイメージを生成し、「
        <strong className="font-semibold">記憶のカード</strong>」を作ります。
      </p>
      {/* 2段目以降も**濃さを落としすぎない**。#5A5348 まで薄くしていたころは
          実測 3.15 で基準（4.5）に届かず、絵の上で字が溶けていた。
          1段目とのわずかな差だけ残して、読める濃さに戻す。

          用途は**それぞれを太字にする**。文のまま流すと、
          読み飛ばした人に「単語帳のサービス」としてだけ残る。
          名詞だけを立てて、拾い読みでも用途の広さが目に入るようにする */}
      <p
        className={`mt-3 text-[0.85rem] leading-relaxed text-balance md:text-base ${
          // 紙以外の版では字を薄くしない。薄い字に縁や影を付けると、
          // そちらのほうが濃くなって字が抜けて見える
          textClass
        }`}
        style={styled ? { color: '#3E3830' } : undefined}
      >
        集めたカードは、
        <strong className="font-semibold">単語帳</strong>や
        <strong className="font-semibold">用語集</strong>での暗記、
        <strong className="font-semibold">図鑑</strong>・
        <strong className="font-semibold">相関図</strong>・
        <strong className="font-semibold">年表</strong>づくりで理解。
        <br />
        さらに、
        <strong className="font-semibold">絵日記</strong>、
        <strong className="font-semibold">タスク管理</strong>、
        <strong className="font-semibold">ビジョンボード</strong>など、使い方は無限大です。
      </p>
      <p
        className={`mt-3 text-[0.85rem] leading-relaxed text-balance md:text-base ${textClass}`}
        style={styled ? { color: '#3E3830' } : undefined}
      >
        {/* 句点で切る。ここも1文ずつ。
            文の途中で行を折ると JSX が改行を空白1つに変えてしまうので、
            折ってよいのは <br /> を挟む場所だけ */}
        作ったカードを、自分の「宮殿」に並べて、整理・組み合わせ・反復練習。
        <br />
        {/* 「記憶のカード」と対になる呼び名なので、同じ太さで置く。
            鉤括弧は前の行の末尾に（次の行の頭だと空白が1つ入る） */}
        それが、自分だけの「
        <strong className="font-semibold">記憶の宮殿</strong>」になっていきます。
      </p>
      </div>
    </div>
  )
}
