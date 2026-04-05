module RequestHelpers
  include RecordBuilderHelpers

  def auth_headers_for(user)
    user.create_new_auth_token
  end

  def json_response
    JSON.parse(response.body)
  end
end
