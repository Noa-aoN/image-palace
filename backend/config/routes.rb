Rails.application.routes.draw do
  get "up" => "health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      mount_devise_token_auth_for "User", at: "auth",
        controllers: {
          registrations: "api/v1/auth/registrations",
          omniauth_callbacks: "api/v1/auth/omniauth_callbacks"
        }
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
        get "users", to: "users#index"
        patch "users/:id/role", to: "users#update_role"
        get "audit_logs", to: "audit_logs#index"
        post "provider_check", to: "provider_checks#create"
        get "feature_flags", to: "feature_flags#index"
        put "feature_flags/:key", to: "feature_flags#upsert"
        delete "feature_flags/:key", to: "feature_flags#destroy"
        get "grant_policies", to: "grant_policies#index"
        put "grant_policies/:key", to: "grant_policies#upsert"
        delete "grant_policies/:key", to: "grant_policies#destroy"
        get "plans", to: "plans#index"
        patch "plans/:id", to: "plans#update"
        get "finance", to: "finances#show"
        put "finance/parameters/:key", to: "finances#update_parameter"
        put "finance/actuals/:year/:month", to: "finances#update_actual"
        resources :posts, only: [ :index, :create, :update, :destroy ] do
          member do
            post :deliver
          end
        end
      end

      # 運営からの読みもの（お知らせ・更新情報・コラム）。公開済みのみ返す
      resources :posts, only: [ :index, :show ], param: :id

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
        # 意味・説明はカード1枚に複数ぶら下がる。並び替えは一括で受ける
        resources :meanings, only: [ :create, :update, :destroy ] do
          collection { patch :reorder }
          member { patch :acknowledge }
        end
        # 項目の値。定義（どの項目を持つか）は property_definitions 側
        put "properties/:property_definition_id", to: "item_properties#upsert", as: :property
        member do
          post :retry
          # セーフガードの承認（覆いを外す）
          post :approve_image
          post :meaning
          post :brief
          post :scene_rewrite
          post :fill_properties
          get :usages
          patch :block_view, action: :update_block_view
          get "reviews/summary", to: "item_reviews#summary"
          post :fact_check
          post "tags", action: :generate_tags
        end
      end
      resources :item_types, only: [ :index ]
      # 作りかけの機能をどこまで出すか（読み取りは全利用者）
      get "features", to: "features#index"
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
