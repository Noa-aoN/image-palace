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
      resources :items, only: [ :index, :create, :show, :update, :destroy ] do
        collection do
          get :summary
        end
        member do
          post :retry
        end
      end
      resources :item_types, only: [ :index ]
      resources :tags, only: [ :index, :create, :update, :destroy ]
      resources :decks, only: [ :index, :create, :show, :update, :destroy ] do
        member do
          post "items", action: :add_item
          delete "items/:item_id", action: :remove_item
        end
      end
      resources :collections, only: [ :index, :create, :show, :update, :destroy ] do
        member do
          post "entries", action: :add_entry
          delete "entries/:entry_type/:entry_id", action: :remove_entry
        end
      end
      resources :spaces, only: [ :index, :create, :show, :update, :destroy ] do
        resources :rooms, only: [ :index, :create, :show, :update, :destroy ] do
          member do
            post "collections", action: :add_collection
            delete "collections/:collection_id", action: :remove_collection
          end
        end
      end
      resources :views, only: [ :index, :create, :show, :update, :destroy ]
    end
  end
end
