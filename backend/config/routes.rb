Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      mount_devise_token_auth_for 'User', at: 'auth'
      get 'health', to: 'health#show'
      get 'health/authenticated', to: 'health#show_authenticated'
    end
  end
end
