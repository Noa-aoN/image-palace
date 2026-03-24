# syntax=docker/dockerfile:1

# ── Stage: base ──────────────────────────────────────────────
FROM ruby:3.3-slim AS base

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      libyaml-dev \
      pkg-config \
      curl \
    && rm -rf /var/lib/apt/lists/*

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

EXPOSE 3001
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3001"]
