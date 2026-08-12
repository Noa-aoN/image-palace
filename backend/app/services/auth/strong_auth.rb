# frozen_string_literal: true

module Auth
  # 強い確認（Passkey / 認証アプリ / 復旧コード）の入り切り。
  #
  # **止められることが要**。作りかけの機能や、思わぬ不具合や、締め出しが起きたとき、
  # 環境変数ひとつで元の姿へ戻せるようにしておく。
  # 画面から消すだけでは足りない（API を直に叩けば通ってしまう）ので、
  # サーバー側でも同じ判断を見る。
  module StrongAuth
    module_function

    # Passkey を使えるようにするか。
    #
    # 切ると、登録の口も確認の口も閉じる。既に登録した鍵は消さない
    # （また入にしたときそのまま使える）。認証アプリには影響しない。
    def passkey_enabled?
      ENV.fetch("PASSKEY_ENABLED", "true") != "false"
    end

    # 運営が入るときに、一次認証のうえで強い確認を求めるか。
    #
    # 切ると、これまでどおり一次認証だけで入れる。
    # 段階的に入れるための栓で、**最初から全員に求めない**
    def admin_required?
      ENV.fetch("ADMIN_STRONG_AUTH_ENABLED", "false") == "true"
    end

    # いま使える確かめ方。画面はこの順で出す
    # （使いやすいものを先に。復旧コードは最後の手段）
    def available_methods(user)
      methods = []
      methods << "passkey" if passkey_enabled? && user.passkey_enrolled?
      methods << "totp" if user.totp_enrolled?
      methods << "recovery_code" if user.totp_recovery_codes.present?
      methods
    end

    # 強い確認を用意しているか。
    # **どれか1つあればよい**（Passkey だけを強いない）
    def prepared?(user)
      available_methods(user).any?
    end
  end
end
