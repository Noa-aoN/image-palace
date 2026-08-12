# frozen_string_literal: true

namespace :auth do
  desc "運営が強い確認の手立てを持っているか調べる（ADMIN_STRONG_AUTH_ENABLED を入にする前に）"
  task admin_readiness: :environment do
    # Flag を入にした瞬間、手立てを持たない運営は執務室へ入れなくなる。
    # **入にする前に、誰が困るのかを先に知っておく。**
    #
    # 秘密そのもの（TOTP の鍵・復旧コード・Passkey の中身）は一切出さない。
    # 出すのは「あるか無いか」と本数だけ。
    admins = User.where(role: %w[support operator admin]).order(:email)
    bootstrap = User.where(email: ENV.fetch("ADMIN_EMAILS", "").split(",").map(&:strip).reject(&:blank?))
    targets = (admins + bootstrap.to_a).uniq

    if targets.empty?
      puts "運営が1人もいません"
      next
    end

    unprepared = []

    puts format("%-34s %-9s %-8s %-8s %s", "メール", "段階", "パスキー", "認証アプリ", "判定")
    puts "-" * 78

    targets.each do |user|
      passkeys = user.webauthn_credentials.count
      totp = user.totp_enrolled?
      ready = Auth::StrongAuth.prepared?(user)
      unprepared << user unless ready

      puts format(
        "%-34s %-9s %-8s %-8s %s",
        user.email.to_s.truncate(34),
        user.effective_role,
        passkeys.zero? ? "-" : "#{passkeys}本",
        totp ? "あり" : "-",
        ready ? "OK" : "未設定"
      )
    end

    puts
    puts "いまの設定: ADMIN_STRONG_AUTH_ENABLED=#{Auth::StrongAuth.admin_required? ? 'true（求めている）' : 'false（求めていない）'}"
    # 「どこで決まっているのか」まで出す。設定が見つからないと、
    # 戻し方も分からない
    puts "          ↑ #{ENV.key?('ADMIN_STRONG_AUTH_ENABLED') ? 'fly secrets で設定（戻す: fly secrets set ADMIN_STRONG_AUTH_ENABLED=false）' : '未設定のためコード側の既定（false）'}"
    puts "          PASSKEY_ENABLED=#{Auth::StrongAuth.passkey_enabled?}"

    if unprepared.empty?
      puts
      puts "全員が手立てを持っています。ADMIN_STRONG_AUTH_ENABLED=true にして問題ありません"
    else
      puts
      puts "#{unprepared.size}人が未設定です。入にすると、この人たちは執務室へ入れなくなります"
      puts "（ログイン自体とアカウント設定は開くので、本人がパスキーか認証アプリを登録すれば戻れます）"
      unprepared.each { |u| puts "  - #{u.email}" }
    end
  end
end
