namespace :credits do
  # 期限付きクレジット（グラント）を付与する。キャンペーン・お詫び付与など。
  # 例: bin/rails 'credits:grant[user@example.com,10,30,campaign]'
  #   引数: email, クレジット数, 有効日数(空=無期限), kind(既定 campaign)
  desc "ユーザーに期限付きクレジット（グラント）を付与する"
  task :grant, %i[email credits days kind] => :environment do |_task, args|
    user = User.find_by!(email: args.fetch(:email))
    points = args.fetch(:credits).to_i * Billing::POINTS_PER_CREDIT
    raise ArgumentError, "credits は正の整数で指定してください" unless points.positive?

    expires_at = args[:days].present? ? args[:days].to_i.days.from_now : nil
    kind = args[:kind].presence || "campaign"

    user.grant_credits!(points, kind: kind, expires_at: expires_at)
    puts "granted #{args.fetch(:credits)}cr to #{user.email} (kind=#{kind}, expires=#{expires_at || 'never'})"
  end

  desc "既に配ってあるクレジットの期限を、いまの寿命へ揃える（DRY_RUN=1 で下見）"
  task align_expiry: :environment do
    dry_run = ENV["DRY_RUN"] == "1"
    include_immediate = ENV["INCLUDE_IMMEDIATE"] == "1"

    puts "寿命: #{Billing::CreditExpiryPolicy.months}ヶ月#{dry_run ? '（下見のみ・書き込まない）' : ''}"

    result = Billing::AlignGrantExpiry.call(dry_run: dry_run, include_immediate: include_immediate)
    puts result

    result.skipped_immediate.each do |grant|
      puts "  触らなかった: #{grant.kind} user=#{grant.user_id} 残#{grant.remaining_points}pt " \
           "（揃えると #{Billing::CreditExpiryPolicy.expires_at(grant.created_at).to_date} で期限切れになる）"
    end

    if result.skipped_immediate.any? && !include_immediate
      puts "揃えると期限切れになる行があります。中身を確かめたうえで INCLUDE_IMMEDIATE=1 で流してください。"
    end
  end
end
