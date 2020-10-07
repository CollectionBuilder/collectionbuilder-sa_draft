
require_relative 'lib/config-helpers'
require_relative 'lib/constants'
require_relative 'lib/task-helpers'
require_relative 'lib/elasticsearch-helpers'

require 'json'


# Define a create_index helper for use by both the create_index and
# create_directory_index tasks that returns a bool indicating whether the
# index was created.
def _create_index profile, index, settings
  # Attempt to create the index.
  res = create_index profile, index, settings, raise_for_status: false

  if res.code == '200'
    # The HTTP response code is 200, indicating that the index was created.
    # Print a message to the console and return true.
    puts "Created Elasticsearch index: #{index}"
    return true
  end

  # The HTTP response code was not 200.
  # Decode the JSON response body to read the error.
  data = JSON.load(res.body)

  # If creation failed because the index already exists, print a message
  # to the console and return false.
  if data['error']['type'] == 'resource_already_exists_exception'
    puts "Elasticsearch index (#{index}) already exists"
    return false
  end

  # An unexpected error occurred. Abort with an error response message.
  abort "[ERROR] Index creation failed - " \
        "Elasticsearch responded with:\n#{JSON.pretty_generate(data)}"
end


# Define a _delete_index helper for use by both the delete_index and
# delete_directory_index tasks that returns a bool indicating whether the
# index was deleted.
def _delete_index profile, index
  # Confirm that the user really wants to delete the index.
  res = prompt_user_for_confirmation "Really delete index \"#{index}\"?"
  if res == false
    return false
  end

  # Attempt to delete the index.
  res = delete_index profile, index, raise_for_status: false

  if res.code == '200'
    # The HTTP response code is 200, indicating that the index was created.
    # Print a message to the console and return true.
    puts "Deleted Elasticsearch index: #{index}"
    return true
  end

  # Decode the JSON response body to read the error.
  data = JSON.load(res.body)

  # If creation failed because the index didn't exist, print a message
  # to the console and return false.
  if data['error']['type'] == 'index_not_found_exception'
    puts "Delete failed. Elasticsearch index (#{index}) does not exist."
    return false
  end

  # An unexpected error occurred. Abort with an error response message.
  abort "[ERROR] Index deletion failed - " \
        "Elasticsearch responded with:\n#{JSON.pretty_generate(data)}"
end


# Enclose Elasticsearch-related tasks in a namespaced called "es", to be
# executed using the convention: `rake es:{task_name}`
namespace :es do


  ###############################################################################
  # list_indices
  ###############################################################################

  desc "Pretty-print the list of existing indices to the console"
  task :list_indices, [:profile] do |t, args|
    res = cat_indices args.profile
    puts JSON.pretty_generate(JSON.load(res.body))
  end


  ###############################################################################
  # create_index
  ###############################################################################

  desc "Create the Elasticsearch index"
  task :create_index, [:profile] do |t, args|

    config = $get_config_for_es_profile.call args.profile
    dev_config = load_config :DEVELOPMENT

    index = config[:elasticsearch_index]

    settings_file_path = File.join([dev_config[:elasticsearch_dir], $ES_INDEX_SETTINGS_FILENAME])
    settings = JSON.load(File.open(settings_file_path, 'rb'))

    # Call the _create_index helper.
    _create_index args.profile, index, settings

  end


  ###############################################################################
  # delete_index
  ###############################################################################

  desc "Delete the Elasticsearch index"
  task :delete_index, [:profile] do |t, args|

    config = $get_config_for_es_profile.call args.profile
    index = config[:elasticsearch_index]

    # Call the _delete_index helper.
    _delete_index args.profile, index

  end


  ###############################################################################
  # create_directory_index
  ###############################################################################

  desc "Create the Elasticsearch directory index"
  task :create_directory_index, [:profile] do |t, args|

    config = $get_config_for_es_profile.call args.profile
    index = config[:elasticsearch_directory_index]
    settings = $ES_DIRECTORY_INDEX_SETTINGS

    # Call the _create_index helper.
    _create_index args.profile, index, settings

  end


  ###############################################################################
  # update_directory_index
  ###############################################################################

  desc "Update the Elasticsearch directory index to reflect the current indices"
  task :update_directory_index, [:profile] do |t, args|
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
  # delete_directory_index
  ###############################################################################

  desc "Delete the Elasticsearch directory index"
  task :delete_directory_index, [:profile] do |t, args|

    config = $get_config_for_es_profile.call args.profile
    index = config[:elasticsearch_directory_index]

    # Call the _delete_index helper.
    _delete_index args.profile, index

  end


  # Close the namespace.
end
