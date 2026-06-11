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
      resources :items, only: [ :index, :create, :show, :update, :destroy ] do
        collection do
          get :summary
        end
        member do
          post :retry
        end
      end
      resources :item_types, only: [ :index ]
    end
  end
end
