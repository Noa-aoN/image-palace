Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch('CORS_ORIGINS', 'http://localhost:3000')
    resource '/api/*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options],
      expose: ['access-token', 'uid', 'client', 'token-type', 'expiry']
  end
end
