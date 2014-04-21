# Serve assets
map '/assets' do
  run Rack::Directory.new(File.join(File.dirname(__FILE__), 'assets'))
end

# Serve api requests
map '/api' do
  app = proc do |env|
    [ 200, {'Content-Type' => 'text/plain'}, ["a"] ]
  end

  run app
end