Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

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
      post "account/avatar", to: "account/avatars#create"
      delete "account/avatar", to: "account/avatars#destroy"

      # 課金（Stripe）
      namespace :billing do
        get "plans", to: "plans#index"
        get "summary", to: "summaries#show"
        post "checkout", to: "checkouts#create"
        post "portal", to: "portals#create"
      end
      post "stripe/webhook", to: "stripe_webhooks#create"

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
        member do
          post :retry
          post :meaning
          post :fact_check
          post "tags", action: :generate_tags
        end
      end
      resources :item_types, only: [ :index ]
      resources :tags, only: [ :index, :create, :update, :destroy ]
      resources :wordlists, only: [ :index, :create, :show, :update, :destroy ]
      # URL は /api/v1/boxes（表示名「ボックス」）。コントローラ・モデルは Box のまま。
      resources :boxes, only: [ :index, :create, :show, :update, :destroy ] do
        member do
          post "entries", action: :add_entry
          delete "entries/:entry_type/:entry_id", action: :remove_entry
          post "cover_image", action: :upload_cover
          delete "cover_image", action: :remove_cover
        end
      end
      resources :spaces, only: [ :index, :create, :show, :update, :destroy ] do
        member do
          post "boxes", action: :add_box
          delete "boxes/:box_id", action: :remove_box
          post "cover_image", action: :upload_cover
          delete "cover_image", action: :remove_cover
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
          patch "edges/:edge_id", to: "view_edges#update"
          delete "edges/:edge_id", to: "view_edges#destroy"
          # deck 種別: カードの並び替え
          patch "reorder", action: :reorder
          post "cover_image", action: :upload_cover
          delete "cover_image", action: :remove_cover
          # space_map 種別: スペースのポイントへカードを配置/クリア
          post "points/:space_point_id", action: :place_on_point
          delete "points/:space_point_id", action: :clear_point
        end
      end
    end
  end
end
