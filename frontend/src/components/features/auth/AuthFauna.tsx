/**
 * 門の奥を飛ぶ渡鴉と蝶。
 *
 * 「宮殿の門の前に立つ」構図なのに、いままで空気だけが動いていなかった。
 * 高いところを渡る鳥と、低いところを舞う蝶がいると、
 * **門の向こうに奥行きのある場所がある**と読める。
 *
 * **門より前の DOM に置く**こと。門（`.auth-arch`）も風景も
 * `position: fixed / z-index: 0` なので、重なりは DOM 順で決まる。
 * 門のあとに置くと、生き物が門の手前を横切ってしまう。
 *
 * 絵は LP と同じものを使う。門と同じ世界の続きに見せたいので、
 * 別の鳥や蝶を用意しない（読み込むものも増えない）。
 */
export function AuthFauna() {
  return (
    <div aria-hidden className="auth-fauna">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero-raven.webp" alt="" decoding="async" loading="lazy" className="auth-raven" />
      {[
        { key: 1, src: '/hero-butterfly-white.webp' },
        { key: 2, src: '/hero-butterfly-orange.webp' },
        { key: 3, src: '/hero-butterfly-green.webp' },
      ].map(({ key, src }) => (
        <div key={key} className={`auth-butterfly auth-butterfly--${key}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" decoding="async" loading="lazy" className="auth-butterfly__wing" />
        </div>
      ))}
    </div>
  )
}
