Rails.application.routes.draw do
  get "up" => "health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      mount_devise_token_auth_for "User", at: "auth",
        controllers: {
          registrations: "api/v1/auth/registrations",
          omniauth_callbacks: "api/v1/auth/omniauth_callbacks"
        }
      # 体験用の宮殿。**認証が要らない、ただ1つの書き込み口**
      get "demo", to: "demo#show"
      post "demo", to: "demo#create"
      # 体験を終える。こちらは認証が要る（自分の宮殿しか片付けられない）
      delete "demo", to: "demo#destroy"
      get "health", to: "health#show"
      get "health/authenticated", to: "health#show_authenticated"
      get "search", to: "search#index"
      post "words/generate", to: "words#generate"
      post "words/check", to: "words#check"
      get "account/export", to: "account#export"
      delete "account", to: "account#destroy"
      # プロフィール（アバター）
      get "account/profile", to: "account/profiles#show"
      patch "account/profile", to: "account/profiles#update"
      post "account/avatar", to: "account/avatars#create"
      delete "account/avatar", to: "account/avatars#destroy"

      # 課金（Stripe）
      namespace :billing do
        get "plans", to: "plans#index"
        get "summary", to: "summaries#show"
        get "ai_usage", to: "ai_usages#show"
        get "credit_transactions", to: "credit_transactions#index"
        post "checkout", to: "checkouts#create"
        # 決済から戻ったときの取り込み（webhook が届かない環境でも反映できるように）
        post "checkout/sync", to: "checkout_syncs#create"
        post "portal", to: "portals#create"
      end
      post "stripe/webhook", to: "stripe_webhooks#create"

      # 運営（管理）。権限の判定は Admin::BaseController で毎リクエスト行う。
      # session だけは一般ユーザーも呼べる（画面の出し分けに使うため）。
      namespace :admin do
        get "session", to: "sessions#show"
        get "overview", to: "overviews#show"
        # 経営の数字（成長・売上・原価）。運営ダッシュボードとは見るものが違う
        get "business", to: "business_metrics#show"
        # 経営の見立て。作るのは明示的に更新したときだけ（開くだけでは作らない）
        get "brief", to: "briefs#show"
        post "brief", to: "briefs#create"
        # 過去のぶんも並べる（新しいものが上）
        get "briefs", to: "briefs#index"
        # 「次にやること」。終わったかどうかだけを持つ
        get "brief_actions", to: "brief_actions#index"
        patch "brief_actions/:id", to: "brief_actions#update"
        get "users", to: "users#index"
        patch "users/:id/role", to: "users#update_role"
        get "audit_logs", to: "audit_logs#index"
        post "provider_check", to: "provider_checks#create"
        resources :ai_models, only: [ :index, :create, :update, :destroy ]
        resources :campaign_codes, only: [ :index, :create, :update, :destroy ]
        # 公式工房。**選んで・確かめて・出す**（編集は本体側で行う）
        get "studio", to: "studio#show"
        get "studio/settings", to: "studio#settings"
        patch "studio/settings", to: "studio#update_settings"
        get "studio/sources", to: "studio#sources"
        get "studio/items", to: "studio#items"
        patch "studio/items/:id/exclusion", to: "studio#update_exclusion"
        post "studio/draft", to: "studio#draft"
        get "studio/preview", to: "studio#current_preview"
        delete "studio/preview", to: "studio#end_preview"
        get "studio/:key/:version/quick_look", to: "studio#quick_look"
        post "studio/:key/:version/preview", to: "studio#preview"
        delete "studio/:key/:version/preview", to: "studio#discard_preview"
        patch "studio/:key/:version/status", to: "studio#update_status"
        patch "studio/:key/delivery", to: "studio#update_delivery"
        get "feature_flags", to: "feature_flags#index"
        # キーに「.」が入る（page.trophy）。制約を付けないと拡張子として切り落とされる
        put "feature_flags/:key", to: "feature_flags#upsert", constraints: { key: %r{[^/]+} }
        delete "feature_flags/:key", to: "feature_flags#destroy", constraints: { key: %r{[^/]+} }
        # 運営クレジット（運営の予算から自分の残高へ入れる）
        get "ops_credits", to: "ops_credits#index"
        post "ops_credits", to: "ops_credits#create"
        get "grant_policies", to: "grant_policies#index"
        put "grant_policies/:key", to: "grant_policies#upsert"
        delete "grant_policies/:key", to: "grant_policies#destroy"
        get "plans", to: "plans#index"
        patch "plans/:id", to: "plans#update"
        # 獲得物・実績・ミッションは1つの入口で扱う（運営から見ると「何を配るか」の1つの話）
        get "rewards", to: "rewards#index"
        # 定義を新しく作る。**配る操作（rewards/grant）とは別物**。
        # ここで作るのは「何があるか」で、誰かの持ち物は増えない
        post "rewards/definitions", to: "rewards#create_reward"
        post "rewards/achievements", to: "rewards#create_achievement"
        post "rewards/missions", to: "rewards#create_mission"
        patch "rewards/definitions/:id", to: "rewards#update_reward"
        # 獲得物の絵。**作る**（AIに描かせる）と**消す**だけ。
        # 差し替えは作り直しで足りる（同じ鍵の絵は1つしか持たない）
        post "rewards/definitions/:id/image", to: "rewards#generate_reward_image"
        delete "rewards/definitions/:id/image", to: "rewards#destroy_reward_image"
        patch "rewards/achievements/:id", to: "rewards#update_achievement"
        patch "rewards/missions/:id", to: "rewards#update_mission"
        post "rewards/grant", to: "rewards#grant"
        get "finance", to: "finances#show"
        put "finance/parameters/:key", to: "finances#update_parameter"
        put "finance/actuals/:year/:month", to: "finances#update_actual"
        resources :posts, only: [ :index, :show, :create, :update, :destroy ] do
          member do
            post :deliver
            # 見出し画像。差し替えと取り外し
            post :cover
            delete :cover, action: :remove_cover
          end
        end
      end

      # 運営からの読みもの（お知らせ・更新情報・コラム）。公開済みのみ返す
      resources :posts, only: [ :index, :show ], param: :id

      # 危険な操作の前の、もう一度の本人確認。
      # 出口は1つ（この端末が確かめ済みか）だが、道筋は方式ごとに分ける
      # （Passkey は challenge を配る段が要る）
      namespace :reauth do
        root to: "/api/v1/reauth#show", via: :get
        post "passkey/options", to: "/api/v1/reauth#passkey_options"
        post "passkey", to: "/api/v1/reauth#verify_passkey"
        post "code", to: "/api/v1/reauth#verify_code"
      end

      # Passkey。登録・一覧・名前変更・削除。まだログインには使わない
      resources :webauthn_credentials, only: [ :index, :create, :update, :destroy ], path: "passkeys" do
        collection do
          post :callback
        end
      end

      # 二要素認証。設定・確認・解除。まだ必須にはしない
      resource :totp, only: [ :show, :create, :destroy ], controller: "totp" do
        post :confirm
        post :regenerate_recovery_codes
      end

      resource :settings, only: [ :show, :update ]

      # お知らせ（生成結果・運営からの通知）
      resources :notifications, only: [ :index ] do
        member do
          post :read
        end
        collection do
          get :unread_count
          post :read_all
        end
      end

      resources :items, only: [ :index, :create, :show, :update, :destroy ] do
        collection do
          get :summary
          get :suggest
          get :navigation
          delete :bulk_destroy
        end
        # 自由な小見出しと、自由な指示で作る絵（項目ごと）
        post "properties/:property_definition_id/free_image", to: "free_images#create"
        # これまでに使った絵。**新しく作らない**（既にある絵を付け替えるだけ）
        resources :media_generations, only: [ :index, :destroy ] do
          member { post :apply }
        end
        # 意味・説明はカード1枚に複数ぶら下がる。並び替えは一括で受ける
        resources :meanings, only: [ :create, :update, :destroy ] do
          collection { patch :reorder }
          member { patch :acknowledge }
        end
        # 関連カード。向きは持たないので、相手のカードの id だけで足し引きする
        resources :relations, only: [ :index, :create, :destroy ]
        # 項目の値。定義（どの項目を持つか）は property_definitions 側
        put "properties/:property_definition_id", to: "item_properties#upsert", as: :property
        member do
          post :retry
          # セーフガードの承認（覆いを外す）
          post :approve_image
          post :meaning
          post :examples
          post :brief
          post :scene_rewrite
          post :fill_properties
          # このカードに持たせるとよい項目を選ばせる（選ぶだけ。保存はしない）
          post :suggest_properties
          get :usages
          patch :block_view, action: :update_block_view
          get "reviews/summary", to: "item_reviews#summary"
          post :fact_check
          # 絵が語と噛み合っているか（運営が段階を開けたときだけ通る）
          post :image_check
          post "tags", action: :generate_tags
        end
      end
      resources :item_types, only: [ :index ]
      # 絵を作るときに選べるモデル（鍵のあるものだけ）
      get "image_models", to: "image_models#index"
      # 作りかけの機能をどこまで出すか（読み取りは全利用者）
      get "features", to: "features#index"
      # 引き換えコードの受け取り
      # Wikipedia の要約。フロントから直接叩かず、ここを通す
      get "wikipedia/summary", to: "wikipedia#summary"
      # 題が一致しなかったときの候補。選ぶのは利用者なので、ここでは保存しない
      get "wikipedia/search", to: "wikipedia#search"
      # 曖昧さ回避ページに並んでいる記事。多義語はここから選び直す
      get "wikipedia/entries", to: "wikipedia#entries"
      # 公式コンテンツの受け取り（デルフォイ）
      get "content_packages", to: "content_packages#index"
      post "content_packages/:key/install", to: "content_packages#install", as: :install_content_package
      get "campaign_codes", to: "campaign_codes#index"
      post "campaign_codes/redeem", to: "campaign_codes#redeem"
      # アチーブメント（栄誉の間）
      get "achievements", to: "achievements#show"
      get "achievements/summary", to: "achievements#summary"
      # 星の入り切り。種別ごとの違いはサーバー側で吸収する
      post "achievements/toggle", to: "achievements#toggle"
      # 学習の記録。1回の学習ぶんをまとめて受ける
      resources :item_reviews, only: [ :create ]
      # カードが持つ項目の定義。種別ごとに利用者が決める
      resources :property_definitions, only: [ :index, :create, :update, :destroy ] do
        collection { patch :reorder }
      end
      resources :tags, only: [ :index, :create, :update, :destroy ]
      resources :tag_groups, only: [ :index, :create, :update, :destroy ] do
        collection do
          patch :reorder
        end
        member do
          post "items", action: :add_item
          delete "items/:tag_id", action: :remove_item
          patch "items/reorder", action: :reorder_items
        end
      end
      resources :wordlists, only: [ :index, :create, :show, :update, :destroy ]
      # URL は /api/v1/boxes（表示名「ボックス」）。コントローラ・モデルは Box のまま。
      resources :boxes, only: [ :index, :create, :show, :update, :destroy ] do
        member do
          post "entries", action: :add_entry
          delete "entries/:entry_type/:entry_id", action: :remove_entry
          post "cover_image", action: :upload_cover
          delete "cover_image", action: :remove_cover
          post "cover_image/generate", action: :generate_cover
        end
      end
      resources :spaces, only: [ :index, :create, :show, :update, :destroy ] do
        member do
          post "boxes", action: :add_box
          delete "boxes/:box_id", action: :remove_box
          post "cover_image", action: :upload_cover
          delete "cover_image", action: :remove_cover
          post "cover_image/generate", action: :generate_cover
        end
        resources :points, controller: "space_points", only: [ :create, :update, :destroy ] do
          collection do
            patch :reorder
          end
        end
      end
      resources :views, only: [ :index, :create, :show, :update, :destroy ] do
        member do
          post "items", action: :add_item
          patch "items/:item_id", action: :update_item
          delete "items/:item_id", action: :remove_item
          # freeboard 種別: カード間の接続線（フローチャート）
          # ボードに置く図形（四角・丸・付箋・見出し・かこみ）
          post "shapes", to: "view_shapes#create"
          patch "shapes/reorder", to: "view_shapes#reorder"
          patch "shapes/:shape_id", to: "view_shapes#update"
          delete "shapes/:shape_id", to: "view_shapes#destroy"
          post "edges", to: "view_edges#create"
          patch "edges/reorder", to: "view_edges#reorder"
          patch "edges/:edge_id", to: "view_edges#update"
          delete "edges/:edge_id", to: "view_edges#destroy"
          # deck 種別: カードの並び替え
          patch "reorder", action: :reorder
          post "cover_image", action: :upload_cover
          delete "cover_image", action: :remove_cover
          post "cover_image/generate", action: :generate_cover
          # ことばの指示でキャンバスを組み立て直す（デッキ / フリーボード）
          post :ai_edit
          post :card_proposal
          post :create_cards
          post :undo
          post :redo
          # freeboard: ボード背景画像
          post "background_image", action: :upload_background
          delete "background_image", action: :remove_background
          # space_map 種別: スペースのポイントへカードを配置/クリア
          post "points/:space_point_id", action: :place_on_point
          delete "points/:space_point_id", action: :clear_point
        end
      end
    end
  end
end
