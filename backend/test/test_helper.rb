ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

Dir[File.join(__dir__, "support/**/*.rb")].sort.each { |file| require file }

class ActiveSupport::TestCase
  include ActiveJob::TestHelper
  include RecordBuilderHelpers

  parallelize(workers: 1)

  setup do
    ActiveJob::Base.queue_adapter = :test
    clear_enqueued_jobs
    clear_performed_jobs
  end
end

class ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper
  include RequestHelpers
end
