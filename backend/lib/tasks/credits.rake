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
end
