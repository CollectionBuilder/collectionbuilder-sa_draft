
require_relative 'config-helpers'
require_relative 'constants'
require_relative 'task-helpers'
require_relative 'elasticsearch-helpers'

require 'json'


###############################################################################
# list_es_indices
###############################################################################

desc "Pretty-print the list of existing indices to the console"
task :list_es_indices, [:profile] do |t, args|
  res = cat_indices args.profile
  puts JSON.pretty_generate(JSON.load(res.body))
end


###############################################################################
# create_es_index
###############################################################################

desc "Create the Elasticsearch index"
task :create_es_index, [:profile] do |t, args|

  config = $get_config_for_es_profile.call args.profile
  dev_config = load_config :DEVELOPMENT

  index = config[:elasticsearch_index]

  settings_file_path = File.join([dev_config[:elasticsearch_dir], $ES_INDEX_SETTINGS_FILENAME])
  settings = JSON.load(File.open(settings_file_path, 'rb'))

  res = create_index args.profile, index, settings, raise_for_status: false

  if res.code == '200'
    puts "Created Elasticsearch index: #{config[:elasticsearch_index]}"
  else
    data = JSON.load(res.body)
    if data['error']['type'] == 'resource_already_exists_exception'
      puts "Elasticsearch index (#{config[:elasticsearch_index]}) already exists"
    else
      raise res.body
    end
  end
end


###############################################################################
# delete_es_index
###############################################################################

desc "Delete the Elasticsearch index"
task :delete_es_index, [:profile] do |t, args|

  index = $get_config_for_es_profile.call(args.profile)[:elasticsearch_index]

  res = prompt_user_for_confirmation "Really delete index \"#{index}\"?"
  if res == false
    next
  end

  res = delete_index args.profile, index, raise_for_status: false

  if res.code == '200'
    puts "Deleted Elasticsearch index: #{index}"
  else
    data = JSON.load(res.body)
    if data['error']['type'] == 'index_not_found_exception'
      puts "Delete failed. Elasticsearch index (#{index}) does not exist."
    else
      raise res.body
    end
  end
end
