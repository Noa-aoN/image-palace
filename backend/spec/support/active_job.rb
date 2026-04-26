RSpec.configure do |config|
  config.include ActiveJob::TestHelper

  config.before do
    ActiveJob::Base.queue_adapter = :test
    clear_enqueued_jobs
    clear_performed_jobs
  end
end
