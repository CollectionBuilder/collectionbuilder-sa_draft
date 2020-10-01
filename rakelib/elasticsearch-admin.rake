
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


###############################################################################
# create_es_directory_index
###############################################################################

desc "Create the Elasticsearch directory index"
task :create_es_directory_index, [:profile] do |t, args|

  index = $get_config_for_es_profile.call(args.profile)[:elasticsearch_directory_index]
  settings = $ES_DIRECTORY_INDEX_SETTINGS

  res = create_index args.profile, index, settings, raise_for_status: false

  if res.code == '200'
    puts "Created Elasticsearch directory index: #{index}"
  else
    data = JSON.load(res.body)
    if data['error']['type'] == 'resource_already_exists_exception'
      puts "Elasticsearch directory index (#{index}) already exists"
    else
      raise res.body
    end
  end
end


###############################################################################
# update_es_directory_index
###############################################################################

desc "Update the Elasticsearch directory index to reflect the current indices"
task :update_es_directory_index, [:profile] do |t, args|
  profile = args.profile

  config = $get_config_for_es_profile.call profile
  directory_index = config[:elasticsearch_directory_index]

  # Get the list of existing indices.
  res = cat_indices args.profile
  all_indices = JSON.load(res.body)

  # Get the list of collection indices by filtering out the directory and internal indices.
  collection_indices = all_indices.reject {
    |x| x['index'].start_with? '.' or x['index'] == directory_index
  }

  # Create a <collection-name> => <index_data> map.
  collection_name_index_map = Hash[ collection_indices.map { |x| [ x['index'], x ] } ]

  # Get the existing directory index documents.
  res = make_request profile, :GET, "/#{directory_index}/_search"
  data = JSON.load(res.body)

  directory_indices = data['hits']['hits'].map { |x| x['_source'] }
  directory_name_index_map = Hash[ directory_indices.map { |x| [ x['index'], x ] } ]

  # Delete any old collection indices from the directory.
  indices_to_remove = directory_name_index_map.keys - collection_name_index_map.keys
  indices_to_remove.each do |index_name|
    delete_document profile, directory_index, index_name
    puts "Deleted index document (#{index_name}) from the directory"
  end

  # Add any new collection indices to the directory.
  indices_to_add = collection_name_index_map.keys - directory_name_index_map.keys
  indices_to_add.each do |index_name|
    index = collection_name_index_map[index_name]
    index_name = index['index']

    # Get the title and description values from the index mapping.
    index_meta = get_index_metadata profile, index_name

    document = {
      :index => index_name,
      :doc_count => index['docs.count'],
      :title => index_meta['title'],
      :description => index_meta['description']
    }

    res = update_document profile, directory_index, index_name, document
    puts "Added index document (#{index_name}) to the directory"
  end

end


###############################################################################
# delete_es_directory_index
###############################################################################

desc "Delete the Elasticsearch directory index"
task :delete_es_directory_index, [:profile] do |t, args|

  index = $get_config_for_es_profile.call(args.profile)[:elasticsearch_directory_index]

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
