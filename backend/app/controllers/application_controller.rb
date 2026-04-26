class ApplicationController < ActionController::API
  include DeviseTokenAuth::Concerns::SetUserByToken

  def resource_name
    :user
  end

  def current_user
    @resource
  end

  def authenticate_user!(opts = {})
    set_user_by_token unless @resource
    render json: { error: "Unauthorized" }, status: :unauthorized unless @resource
  end
end
