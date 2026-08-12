# frozen_string_literal: true

# 締め出されたときの逃げ道。**画面からは戻せない状態を、ここから戻す。**
#
# 権限や二要素は、間違えると自分が入れなくなる種類の設定になる。
# 画面の中だけで完結させると、閉じ込められたときに開ける人が居なくなるので、
# サーバー側から開けられる口を必ず残しておく。
#
# 実行は worker 機で（app 機で重い処理を回すと本番 API が落ちる）:
#   fly machine exec <worker-id> -a image-palace-api \
#     "/bin/sh -c 'cd /app && bin/rails admin:promote[someone@example.com]'"
namespace :admin do
  desc "指定したメールアドレスの利用者を管理者にする"
  task :promote, [ :email ] => :environment do |_t, args|
    user = find_user!(args[:email])
    previous = user.role
    user.update!(role: "admin")
    AdminAuditLog.record!(
      actor: user, action: "user.role_changed",
      target: user, details: { from: previous, to: "admin", via: "rake" }
    )
    puts "#{user.email} を admin にしました（#{previous} → admin）"
  end

  desc "役割を指定して変える（user / support / operator / admin）"
  task :set_role, [ :email, :role ] => :environment do |_t, args|
    role = args[:role].to_s
    abort "知らない役割です: #{role}（#{User::ROLES.join(' / ')}）" unless User::ROLES.include?(role)

    user = find_user!(args[:email])
    # 画面と同じ守り。最後の管理者を降ろすと、権限を戻せる人が居なくなる。
    # ここでも塞ぐが、どうしてもの場合は先に別の人を admin にしてから
    if User.last_admin?(user) && User::ROLE_RANK.fetch(role) < User::ROLE_RANK.fetch("admin")
      abort "最後の管理者は降格できません。先に別の人を admin にしてください。"
    end

    previous = user.role
    user.update!(role: role)
    AdminAuditLog.record!(
      actor: user, action: "user.role_changed",
      target: user, details: { from: previous, to: role, via: "rake" }
    )
    puts "#{user.email}: #{previous} → #{role}"
  end

  desc "二要素認証を外す（端末を失ったときの逃げ道）"
  task :reset_totp, [ :email ] => :environment do |_t, args|
    user = find_user!(args[:email])
    unless user.totp_enrolled?
      puts "#{user.email} は二要素を設定していません"
      next
    end

    user.update!(totp_secret: nil, totp_confirmed_at: nil, totp_recovery_codes: [], reauthenticated_at: nil)
    AdminAuditLog.record!(actor: user, action: "totp.disabled", target: user, details: { via: "rake" })
    puts "#{user.email} の二要素を外しました。本人に設定し直してもらってください"
  end

  desc "いま運営権限を持っている人を出す"
  task admins: :environment do
    User.effective_admins.find_each do |user|
      via = user.bootstrap_admin? ? "ENV(ADMIN_EMAILS)" : "DB"
      puts "  #{user.email} 役割=#{user.effective_role} 由来=#{via}"
    end
    puts "（該当なし。ADMIN_EMAILS を確かめてください）" if User.effective_admins.none?
  end

  def find_user!(email)
    address = email.to_s.strip.downcase
    abort "メールアドレスを渡してください" if address.blank?

    user = User.find_by("LOWER(email) = ?", address)
    abort "見つかりません: #{address}" if user.nil?
    user
  end
end
