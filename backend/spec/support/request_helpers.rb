module RequestHelpers
  # devise-token-auth のトークン認証用ヘッダを生成する
  def auth_headers_for(user)
    user.create_new_auth_token
  end

  # API レスポンスを JSON としてパースする
  def json_response
    JSON.parse(response.body)
  end

  # レスポンスヘッダから auth トークンを取り出す（連続リクエスト用）
  def auth_headers_from_response
    %w[access-token client uid token-type expiry].each_with_object({}) do |key, headers|
      headers[key] = response.headers[key] if response.headers[key]
    end
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end
