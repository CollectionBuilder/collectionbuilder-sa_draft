
require 'yaml'

require_relative 'constants'


# Return the credentials for the specified Elasticsearch profile.
def get_es_profile_credentials profile = "admin"
  creds = YAML.load_file $ES_CREDENTIALS_PATH
  if !creds.include? "profiles"
    raise "\"profiles\" key not found in: #{$ES_CREDENTIALS_PATH}"
  elsif !creds['profiles'].include? profile
    raise "No credentials found for profile: \"#{profile}\""
  else
    return creds['profiles'][profile]
  end
end


# Return the Elasticsearch protocol, host, port, user for a specific profile.
def get_es_profile_request_args profile
  config = $get_config_for_es_user.call profile
  creds = if profile != nil then get_es_profile_credentials(profile) else nil end
  return config[:elasticsearch_protocol],
         config[:elasticsearch_host],
         config[:elasticsearch_port],
         creds
end


def make_es_request profile, method, path, body=nil, content_type=nil, raise_for_status=true
  # Get the user-profile-specific request args.
  protocol, host, port, creds = get_es_profile_request_args profile

  initheader = { 'Accept' => $APPLICATION_JSON }
  if content_type != nil
    initheader['Content-Type'] = content_type
  end

  req_fn =
    case method
    when :GET
      Net::HTTP::Get
    when :PUT
      Net::HTTP::Put
    when :POST
      Net::HTTP::Post
    when :DELETE
      Net::HTTP::Delete    else
      raise "Unhandled HTTP method: #{method}"
    end

  req = req_fn.new(path, initheader = initheader)

  # If an Elasticsearch user was specified, use their credentials to configure
  # basic auth.
  if creds != nil
    req.basic_auth creds['username'], creds['password']
  end

  # Set any specified body.
  if body != nil
    req.body = body
  end

  # Make the request.
  begin
    res = Net::HTTP.start(host, port, :use_ssl => protocol == 'https') do |http|
    http.request(req)
    end
  rescue Errno::ECONNREFUSED
    puts "Elasticsearch not found at: #{host}:#{port}"
    if creds == nil
      puts 'By default, the Elasticsearch-related rake tasks attempt to operate on the local, ' +
           'development ES instance. If you want to operate on a production instance, please ' +
           'specify the <profile-name> rake task argument.'
    end
    exit 1
  end

  # Maybe raise an exception on non-HTTPSuccess (i.e. 2xx) response status.
  if raise_for_status and res.code.to_i >= 300
    raise "Elasticsearch Request Failed: #{res.body}"
  end

  return res
end


###############################################################################
# Elasticsearch API Endpoints
###############################################################################

def cat_indices profile
  # https://www.elastic.co/guide/en/elasticsearch/reference/current/cat-indices.html
  return make_es_request(profile, method=:GET, path='/_cat/indices')
end
