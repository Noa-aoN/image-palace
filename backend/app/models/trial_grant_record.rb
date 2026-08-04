# frozen_string_literal: true

# お試し枠を配った相手の記録。アカウントを消しても残す。
#
# 保持するのはハッシュだけで、元のアドレスへは戻せない。
# 「この相手にはもう配ったか」を照合する以外に使えない形にしてある。
class TrialGrantRecord < ApplicationRecord
  self.record_timestamps = false

  SOURCES = %w[email oauth].freeze

  validates :identifier_digest, presence: true, uniqueness: true
  validates :source, inclusion: { in: SOURCES }

  # 鍵付きハッシュ。鍵はアプリの秘密鍵から導出するので、外から作れない。
  # 単なる SHA256 だと、アドレスを総当たりして突き合わせられてしまう。
  def self.digest_for(value)
    OpenSSL::HMAC.hexdigest("SHA256", hash_key, value.to_s.strip.downcase)
  end

  def self.hash_key
    Rails.application.key_generator.generate_key("trial_grant_record", 32)
  end

  # この相手にすでに配っているか
  def self.granted?(identifiers)
    digests = identifiers.filter_map { |_source, value| digest_for(value) if value.present? }
    return false if digests.empty?

    exists?(identifier_digest: digests)
  end

  # 配った相手として覚える。同時に走っても落ちないようにする
  def self.remember!(identifiers)
    identifiers.each do |source, value|
      next if value.blank?

      create!(identifier_digest: digest_for(value), source: source.to_s, created_at: Time.current)
    rescue ActiveRecord::RecordNotUnique
      next
    end
  end
end
