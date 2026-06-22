# frozen_string_literal: true

# Stripe API キーはバックエンドのみに保持する（フロントから直接呼び出さない）。
# 未設定の環境では API 呼び出しを行う機能だけが無効になり、起動は妨げない。
Stripe.api_key = ENV["STRIPE_SECRET_KEY"] if defined?(Stripe) && ENV["STRIPE_SECRET_KEY"].present?
