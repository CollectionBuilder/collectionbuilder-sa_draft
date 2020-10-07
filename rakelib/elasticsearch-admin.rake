
require_relative 'lib/config-helpers'
require_relative 'lib/constants'
require_relative 'lib/task-helpers'
require_relative 'lib/elasticsearch-helpers'

require 'json'


# Define an Elasticsearch error response abort helper.
def _abort what_failed, data
  abort "[ERROR] #{what_failed} failed - " \
        "Elasticsearch responded with:\n#{JSON.pretty_generate(data)}"
end


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

  # Abort on unexpected error.
  _abort 'Index creation', data
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

  # Abort on unexpected error.
  _abort 'Index deletion', data
end


# Enclose Elasticsearch-related tasks in a namespaced called "es", to be
# executed using the convention: `rake es:{task_name}`
namespace :es do


  ###############################################################################
  # list_indices
  ###############################################################################

  desc "Pretty-print the list of existing indices to the console"
  task :list_indices, [:profile] do |t, args|
    # Make the API request, letting it fail if the response status != 200.
    res = cat_indices args.profile

    # Decode the response data.
    data = JSON.load(res.body)

    # Prett-print the response data.
    puts JSON.pretty_generate(data)
  end


  ###############################################################################
  # create_index
  ###############################################################################

  desc "Create the Elasticsearch index"
  task :create_index, [:profile] do |t, args|
    # Read the index name from the config.
    config = $get_config_for_es_profile.call args.profile
    index = config[:elasticsearch_index]

    # Load the index settings from the local generated index settings file.
    dev_config = load_config :DEVELOPMENT
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
    # Read the index name from the config.
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
    # Read the directory index name from the config.
    config = $get_config_for_es_profile.call args.profile
    index = config[:elasticsearch_directory_index]

    # Read the directory index settings from a global constant.
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
    # Read the directory index name from the config.
    config = $get_config_for_es_profile.call args.profile
    index = config[:elasticsearch_directory_index]

    # Call the _delete_index helper.
    _delete_index args.profile, index
  end


  ###############################################################################
  # create_snapshot_s3_repository
  ###############################################################################

  desc "Create an Elasticsearch snapshot repository that uses S3-compatible storage"
  task :create_snapshot_s3_repository,
       [:profile, :bucket, :base_path, :repository_name] do |t, args|

    args.with_defaults(
      :base_path => $ES_DEFAULT_SNAPSHOT_REPOSITORY_BASE_PATH,
      :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
    )

    bucket = args.bucket
    # If bucket was not specified, attempt to parse a default value from the config
    # remote_objects_url.
    if bucket == nil
      config = $get_config_for_es_profile.call args.profile
      if config.has_key? :remote_objects_url
        begin
          bucket, = parse_digitalocean_space_url config[:remote_objects_url]
        rescue
        end
      end
    end

    if bucket == nil
      # Bucket was not specified and we could not parse a default value from the
      # config remote_objects_url.
      assert_required_args args, [ :bucket ]
    end

    # Make the API request.
    res = create_snapshot_repository args.profile, args.repository_name, 's3',
                                     { :bucket => bucket, :base_path => args.base_path },
                                     raise_for_status: false

    # Abort on unexpected error.
    if res.code != '200'
      data = JSON.load(res.body)
      _abort 'Snapshot repository creation', data
    end

    puts "Elasticsearch S3 snapshot repository (#{args.repository_name}) created"
  end


  ###############################################################################
  # list_es_snapshot_repositories
  ###############################################################################

  desc "List the existing Elasticsearch snapshot repositories"
  task :list_snapshot_repositories, [:profile] do |t, args|
    # Make the API request.
    res = get_snapshot_repositories args.profile, raise_for_status: false

    # Decode the response data.
    data = JSON.load(res.body)

    # Abort on unexpected error.
    if res.code != '200'
      _abort 'Get snapshot repositories', data
    end

    # Print the response data.
    puts JSON.pretty_generate(data)
  end


  ###############################################################################
  # list_es_snapshots
  ###############################################################################

  desc "List available Elasticsearch snapshots"
  task :list_snapshots, [:profile, :repository_name] do |t, args|
    args.with_defaults(
      :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
    )

    # Make the API request.
    res = get_repository_snapshots args.profile, args.repository_name,
                                   raise_for_status: false

    # Decode the response data.
    data = JSON.load res.body

    # Abort un unexpected error.
    if res.code != '200'
      _abort 'List snapshots', data
    end

    # Pretty-print the response data.
    puts JSON.pretty_generate(data)
  end


# Close the namespace.
end
