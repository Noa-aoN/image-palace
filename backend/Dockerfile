# syntax=docker/dockerfile:1

# ── Stage: base ──────────────────────────────────────────────
FROM ruby:3.3-slim AS base

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      libyaml-dev \
      libvips42 \
      pkg-config \
      curl \
    && rm -rf /var/lib/apt/lists/* \
    # CVE-2026-66066 対策の1層目: 使わない libvips ローダモジュールをイメージから消す。
    # 本アプリが扱うのは PNG/JPEG/WebP のみ（ImageFormat::ALLOWED）。
    # heif/pdf は block_untrusted の対象外で素通りする（8.16.1 で実測）ため、
    # ブロックではなくモジュールごと削除して攻撃面そのものを無くす。
    # 特に heif は壊れた入力でプロセスごと abort する。
    # 削除は apt と同一レイヤで行う（後段レイヤだと .so がイメージ内に残るため）
    && find /usr/lib -type d -name 'vips-modules-*' \
         -exec rm -f {}/vips-heif.so {}/vips-jxl.so {}/vips-magick.so \
                     {}/vips-openslide.so {}/vips-poppler.so \;

ENV BUNDLE_PATH="/usr/local/bundle"

WORKDIR /app

# ── Stage: builder ───────────────────────────────────────────
FROM base AS builder

COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3

# ── Stage: production ────────────────────────────────────────
FROM base AS production

COPY --from=builder /usr/local/bundle /usr/local/bundle

COPY . .
# Depot キャッシュが古い database.yml を使う問題への対策
COPY config/database.yml config/database.yml

EXPOSE 8080
CMD ["bash", "-c", "bundle exec rails server -b 0.0.0.0 -p ${PORT:-8080}"]
