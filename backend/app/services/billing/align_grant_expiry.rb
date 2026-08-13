# frozen_string_literal: true

module Billing
  # 既に配ってあるクレジットの期限を、いまの寿命（CreditExpiryPolicy）へ揃える。
  #
  # 実装・規約・画面・本番データが別々の長さを指していると、
  # 「規約には3ヶ月と書いてあるのに、残高の内訳は6ヶ月後」という食い違いが残る。
  #
  # ## 決めごと
  #
  # 1. **縮めるだけ。伸ばさない。** 既にいまの寿命より短いものは触らない。
  #    配ったものを取り上げないのと同じ理由で、短くしておいたものを勝手に延ばさない。
  # 2. **即時失効は既定で行わない。** 揃えると期限が過ぎてしまう行は、
  #    触らずに数えて返す。気づかないうちに残高が消えるのがいちばん困る。
  #    それでも揃えるときは `include_immediate: true` を明示する。
  # 3. **何度流しても同じ結果になる。** 2回目は0件になる。
  class AlignGrantExpiry
    Result = Struct.new(:examined, :updated, :already_aligned, :skipped_immediate, keyword_init: true) do
      def to_s
        "調べた#{examined}件 / 揃えた#{updated}件 / 既に揃っていた#{already_aligned}件 / " \
          "即時失効になるため触らなかった#{skipped_immediate.size}件"
      end
    end

    def self.call(...)
      new(...).call
    end

    def initialize(dry_run: false, include_immediate: false, now: Time.current)
      @dry_run = dry_run
      @include_immediate = include_immediate
      @now = now
    end

    def call
      result = Result.new(examined: 0, updated: 0, already_aligned: 0, skipped_immediate: [])

      CreditGrant.find_each do |grant|
        result.examined += 1
        target = target_expires_at(grant)

        # 期限なし（古い買い切り）も、いまの寿命に合わせて期限を持たせる
        if grant.expires_at.present? && grant.expires_at <= target
          result.already_aligned += 1
          next
        end

        if target <= @now && !@include_immediate
          result.skipped_immediate << grant
          next
        end

        grant.update_column(:expires_at, target) unless @dry_run
        result.updated += 1
      end

      result
    end

    private

    # 配った日から数える。持ち越しだけは、当月分として1ヶ月すでに居たぶんを引く
    # （いま同じものを積んだときと同じ期限になる）
    def target_expires_at(grant)
      if grant.kind == "subscription_carryover"
        CreditExpiryPolicy.carryover_expires_at(grant.created_at)
      else
        CreditExpiryPolicy.expires_at(grant.created_at)
      end
    end
  end
end
