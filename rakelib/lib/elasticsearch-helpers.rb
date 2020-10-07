
require 'yaml'

require_relative 'config-helpers'
require_relative 'constants'


###############################################################################
# Elasticsearch Config Helpers
###############################################################################

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


# Return the Elasticsearch protocol, host, port, and credentials for a given
# profile.
def get_es_profile_request_args profile
  config = $get_config_for_es_profile.call profile
  creds = if profile != nil then get_es_profile_credentials(profile) else nil end
  return config[:elasticsearch_protocol],
         config[:elasticsearch_host],
         config[:elasticsearch_port],
         creds
end


###############################################################################
# Elasticsearch HTTP Request Helpers
###############################################################################

def make_request profile, method, path, body: nil, headers: nil,
                 raise_for_status: true
  # Get the user-profile-specific request args.
  protocol, host, port, creds = get_es_profile_request_args profile

  # Set initheader to always accept/expect JSON responses.
  initheader = { 'Accept' => $APPLICATION_JSON }

  # Update initheader with any custom, specified headers.
  if headers != nil
    initheader.update(headers)
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

  req = req_fn.new(path, initheader=initheader)

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


# Define a make_request() wrapper that takes care of setting the Content-Type
# and encoding the body of a JSON request.
def make_json_request profile, method, path, data, **kwargs
  return make_request(
    profile,
    method,
    path,
    body: JSON.dump(data),
    headers: { 'content-type' => $APPLICATION_JSON },
    **kwargs
  )
end


###############################################################################
# Misc Helpers
###############################################################################

# Get the index mapping _meta value.
def get_index_metadata profile, index
  res = make_request profile, :GET, "/#{index}/_mapping"
  data = JSON.load res.body
  return data[index]['mappings']['_meta']
end


###############################################################################
# Elasticsearch API Endpoint Wrappers
###############################################################################

# https://www.elastic.co/guide/en/elasticsearch/reference/current/cat-indices.html
def cat_indices profile, **kwargs
  return make_request profile, :GET, '/_cat/indices', **kwargs
end


# https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-create-index.html
def create_index profile, index, settings, **kwargs
  return make_json_request profile, :PUT, "/#{index}", settings, **kwargs
end


# https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-delete-index.html
def delete_index profile, index, **kwargs
  return make_request profile, :DELETE, "/#{index}", **kwargs
end


# https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-update.html
def update_document profile, index, doc_id, doc, **kwargs
  return make_json_request profile, :POST, "/#{index}/_doc/#{doc_id}", doc, **kwargs
end


# https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-delete.html
def delete_document profile, index, doc_id, **kwargs
  return make_request profile, :DELETE, "/#{index}/_doc/#{doc_id}", **kwargs
end


# https://www.elastic.co/guide/en/elasticsearch/reference/current/put-snapshot-repo-api.html
def create_snapshot_repository profile, name, type, settings, **kwargs
  return make_json_request profile, :PUT, "/_snapshot/#{name}",
                           { :type => type, :settings => settings }, **kwargs
end


# https://www.elastic.co/guide/en/elasticsearch/reference/7.9/get-snapshot-repo-api.html
def get_snapshot_repositories profile, **kwargs
  return make_request profile, :GET, "/_snapshot", **kwargs
end


# https://www.elastic.co/guide/en/elasticsearch/reference/7.9/get-snapshot-api.html
def get_repository_snapshots profile, repository, **kwargs
  return make_request profile, :GET, "/_snapshot/#{repository}/*", **kwargs
end
