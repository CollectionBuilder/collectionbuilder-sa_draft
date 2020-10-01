
require "cgi"
require 'csv'
require 'json'
require 'yaml'
require 'net/http'

require 'aws-sdk-s3'


###############################################################################
# Constants
###############################################################################

$APPLICATION_JSON = 'application/json'

$S3_URL_REGEX = /^https?:\/\/(?<bucket>[^\.]+)\.(?<region>\w+)(?:\.cdn)?\.digitaloceanspaces\.com(?:\/(?<prefix>.+))?$/

$ES_CREDENTIALS_PATH = File.join [Dir.home, ".elasticsearch", "credentials"]
$ES_BULK_DATA_FILENAME = 'es_bulk_data.jsonl'
$ES_INDEX_SETTINGS_FILENAME = 'es_index_settings.json'
$SEARCH_CONFIG_PATH = File.join(['_data', 'config-search.csv'])
$ENV_CONFIG_FILENAMES_MAP = {
  :DEVELOPMENT => [ '_config.yml' ],
  :PRODUCTION_PREVIEW => [ '_config.yml', '_config.production_preview.yml' ],
  :PRODUCTION => [ '_config.yml', '_config.production.yml' ],
}


# Define an Elasticsearch snapshot name template that will automatically include the current date and time.
# See: https://www.elastic.co/guide/en/elasticsearch/reference/current/date-math-index-names.html#date-math-index-names
$ES_MANUAL_SNAPSHOT_NAME_TEMPLATE = CGI.escape "<snapshot-{now/d{yyyyMMdd-HHmm}}>"
$ES_SCHEDULED_SNAPSHOT_NAME_TEMPLATE = "<scheduled-snapshot-{now/d{yyyyMMdd-HHmm}}>"

$ES_DEFAULT_SNAPSHOT_REPOSITORY_BASE_PATH = '_elasticsearch_snapshots'
$ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME = 'default'
$ES_DEFAULT_SNAPSHOT_POLICY_NAME = 'default'


###############################################################################
# Helper Functions
###############################################################################

$ensure_dir_exists = ->(dir) { if !Dir.exists?(dir) then Dir.mkdir(dir) end }

def assert_env_arg_is_valid env, valid_envs=["DEVELOPMENT", "PRODUCTION_PREVIEW", "PRODUCTION"]
  if !valid_envs.include? env
    puts "Invalid environment value: \"#{env}\". Please specify one of: #{valid_envs}"
    exit 1
  end
end

def assert_required_args args, req_args
  # Assert that the task args object includes a non-nil value for each arg in req_args.
  missing_args = req_args.filter { |x| !args.has_key?(x) or args.fetch(x) == nil }
  if missing_args.length > 0
    puts "The following required task arguments must be specified: #{missing_args}"
    exit 1
  end
end


def elasticsearch_ready config
  # Return a boolean indicating whether the Elasticsearch instance is available.
  req = Net::HTTP.new(config[:elasticsearch_host], config[:elasticsearch_port])
  if config[:elasticsearch_protocol] == 'https'
    req.use_ssl = true
  end
  begin
    res = req.send_request('GET', '/')
  rescue StandardError
    false
  else
    res.code == '200'
  end
end


def parse_digitalocean_space_url url
  # Parse a Digital Ocean Space URL into its constituent S3 components, with the expectation
  # that it has the format:
  # <protocol>://<bucket-name>.<region>.cdn.digitaloceanspaces.com[/<prefix>]
  # where the endpoint will be: <region>.digitaloceanspaces.com
  match = $S3_URL_REGEX.match url
  if !match
    puts "digital-objects URL \"#{url}\" does not match the expected "\
         "pattern: \"#{$S3_URL_REGEX}\""
    exit 1
  end
  bucket = match[:bucket]
  region = match[:region]
  prefix = match[:prefix]
  endpoint = "https://#{region}.digitaloceanspaces.com"
  return bucket, region, prefix, endpoint
end


###############################################################################
# TASK: deploy
###############################################################################

desc "Build site with production env"
task :deploy do
  ENV['JEKYLL_ENV'] = "production"
  sh "jekyll build --config _config.yml,_config.production.yml"
end


###############################################################################
# TASK: serve
###############################################################################

desc "Run the local web server"
task :serve, [:env] do |t, args|
  args.with_defaults(
    :env => "DEVELOPMENT"
  )
  assert_env_arg_is_valid args.env, [ 'DEVELOPMENT', 'PRODUCTION_PREVIEW' ]
  env = args.env.to_sym
  config_filenames = $ENV_CONFIG_FILENAMES_MAP[env]
  sh "jekyll s --config #{config_filenames.join(',')} -H 0.0.0.0"
end


###############################################################################
# TASK: generate_derivatives
###############################################################################

desc "Generate derivative image files from collection objects"
task :generate_derivatives, [:thumbs_size, :small_size, :density, :missing, :im_executable] do |t, args|
  args.with_defaults(
    :thumbs_size => "300x300",
    :small_size => "800x800",
    :density => "300",
    :missing => "true",
    :im_executable => "magick",
  )

  config = load_config :DEVELOPMENT
  objects_dir = config[:objects_dir]
  thumb_images_dir = config[:thumb_images_dir]
  small_images_dir = config[:small_images_dir]

  # Ensure that the output directories exist.
  [thumb_images_dir, small_images_dir].each &$ensure_dir_exists

  EXTNAME_TYPE_MAP = {
    '.jpg' => :image,
    '.pdf' => :pdf
  }

  # Generate derivatives.
  Dir.glob(File.join([objects_dir, '*'])).each do |filename|
    # Ignore subdirectories.
    if File.directory? filename
      next
    end

    # Determine the file type and skip if unsupported.
    extname = File.extname(filename).downcase
    file_type = EXTNAME_TYPE_MAP[extname]
    if !file_type
      puts "Skipping file with unsupported extension: #{extname}"
      next
    end

    # Define the file-type-specific ImageMagick command prefix.
    cmd_prefix =
      case file_type
      when :image then "#{args.im_executable} #{filename}"
      when :pdf then "#{args.im_executable} -density #{args.density} #{filename}[0]"
      end

    # Get the lowercase filename without any leading path and extension.
    base_filename = File.basename(filename, extname).downcase

    # Generate the thumb image.
    thumb_filename=File.join([thumb_images_dir, "#{base_filename}_th.jpg"])
    if args.missing == 'false' or !File.exists?(thumb_filename)
      puts "Creating: #{thumb_filename}";
      system("#{cmd_prefix} -resize #{args.thumbs_size} -flatten #{thumb_filename}")
    end

    # Generate the small image.
    small_filename = File.join([small_images_dir, "#{base_filename}_sm.jpg"])
    if args.missing == 'false' or !File.exists?(small_filename)
      puts "Creating: #{small_filename}";
      system("#{cmd_prefix} -resize #{args.small_size} -flatten #{small_filename}")
    end
  end
end


###############################################################################
# TASK: normalize_object_filenames
###############################################################################

desc "Rename the object files to match their corresponding objectid metadata value"
task :normalize_object_filenames, [:force] do |t, args|
  args.with_defaults(
    :force => "false"
  )
  force = args.force == "true"

  config = load_config :DEVELOPMENT
  objects_dir = config[:objects_dir]
  objects_backup_dir = File.join([objects_dir, '_prenorm_backup'])

  FORMAT_EXTENSION_MAP = {
    'image/jpg' => '.jpg',
    'application/pdf' => '.pdf'
  }

  VALID_FORMATS = Set[*FORMAT_EXTENSION_MAP.keys]

  def get_normalized_filename(objectid, format)
    return "#{objectid}#{FORMAT_EXTENSION_MAP[format]}"
  end

  # Do a dry run to check that:
  #  - there are no objectid collisions
  #  - there are no filename collisions
  #  - all format values are valid
  #  - all referenced filenames are present
  #  - the existing filename extension matches the format
  #  - no renamed filename will overwrite an existing
  seen_objectids = Set[]
  duplicate_objectids = Set[]
  seen_filenames = Set[]
  duplicate_filenames = Set[]
  invalid_formats = Set[]
  missing_files = Set[]
  invalid_extensions = Set[]
  existing_filename_collisions = Set[]
  num_items = 0
  config[:metadata].each do |item|
    # Check for objectids collisions.
    objectid = item['objectid']
    if seen_objectids.include? objectid
      duplicate_objectids.add objectid
    else
      seen_objectids.add objectid
    end

    # Check that the format is valid.
    format = item['format']
    if !VALID_FORMATS.include? format
      invalid_formats.add format
    end

    filename = item['filename']
    # Check for metadata filename collisions.
    if seen_filenames.include? filename
      duplicate_filenames.add filename
    else
      seen_filenames.add filename
    end
    # Check whether the file exists.
    if !File.exist? File.join([objects_dir, filename])
      missing_files.add filename
    end

    # Check that the existing filename extension matches the format.
    extension = File.extname(filename)
    if extension != FORMAT_EXTENSION_MAP[format]
      invalid_extensions.add extension
    end

    # If the new filename is different than the one specified in the metadata,
    # Check that the new filename will not overwrite an existing file.
    normalized_filename = get_normalized_filename(objectid, format)
    if normalized_filename != filename and File.exist? File.join([objects_dir, normalized_filename])
      existing_filename_collisions.add normalized_filename
    end

    num_items += 1
  end

  if (duplicate_objectids.size +
      duplicate_filenames.size +
      invalid_formats.size +
      missing_files.size +
      invalid_extensions.size +
      existing_filename_collisions.size
     ) > 0
    print "The following errors were detected:\n"
    if duplicate_objectids.size > 0
      print " - metadata contains duplicate 'objectid' value(s): #{duplicate_objectids.to_a}\n"
    end
    if duplicate_filenames.size > 0
      print " - metadata contains duplicate 'filename' value(s): #{duplicate_filenames.to_a}\n"
    end
    if invalid_formats.size > 0
      print " - metadata specifies unsupported 'format' value(s): #{invalid_formats.to_a}\n"
    end
    if missing_files.size > 0
      print " - metadata specifies 'filename' value(s) for which a file does not exist: #{missing_files.to_a}\n"
    end
    if invalid_extensions.size > 0
      print " - existing filename extensions do not match their format: #{invalid_extensions.to_a}\n"
    end
    if existing_filename_collisions.size > 0
      print " - renamed files would have overwritten existing files: #{existing_filename_collisions.to_a}\n"
    end
    if !force
      # Abort the task
      next
    else
      print "The 'force' argument was specified, continuing...\n"
    end
  end

  # Everything looks good - do the renaming.
  res = prompt_user_for_confirmation "Rename #{num_items} files to match their objectid?"
  if res == false
    next
  end

  # Optionally backup the original files.
  res = prompt_user_for_confirmation "Create backups of the original files in #{objects_backup_dir} ?"
  if res == true
    $ensure_dir_exists.call objects_backup_dir
    Dir.glob(File.join([objects_dir, '*'])).each do |filename|
      if !File.directory? filename
        FileUtils.cp(
          filename,
          File.join([objects_backup_dir, File.basename(filename)])
        )
      end
    end
  end

  config[:metadata].each do |item|
    objectid = item['objectid']
    filename = item['filename']
    format = item['format']

    normalized_filename = get_normalized_filename(objectid, format)

    # Leave the file alone if its filename is already normalized.
    if normalized_filename == filename
      next
    end

    existing_path = File.join([objects_dir, filename])
    new_path = File.join([objects_dir, normalized_filename])
    File.rename(existing_path, new_path)

    print "Renamed \"#{existing_path}\" to \"#{new_path}\"\n"
  end

  # Check whether any files with a filename derived from the old filenames exist.
  extracted_text_files = Dir.glob("#{config[:extracted_pdf_text_dir]}/*")
  derivative_files = (Dir.glob("#{config[:thumb_images_dir]}/*") +
                      Dir.glob("#{config[:small_images_dir]}/*"))

  if extracted_text_files.size > 0
       print "\nIt looks like you ran the extract_pdf_text task before normalizing the filenames. Since the extracted text files are given names that are based on that of the original file, you need to delete the existing files and run the extract_pdf_text task again.\n"
    res = prompt_user_for_confirmation "Delete the existing extracted PDF text files now?"
    if res == true
      FileUtils.rm extracted_text_files
    end
    print "Deleted #{extracted_text_files.size} extracted text files from \"#{config[:extracted_pdf_text_dir]}\". Remember to rerun the extract_pdf_text rake task.\n"
  end

  if derivative_files.size > 0
       print "\nIt looks like you ran the generate_derivatives task before normalizing the filenames. Since the direvative files are given names that are based on that of the original file, you need to delete the existing files and run the generate_derivatives task again.\n"
    res = prompt_user_for_confirmation "Delete the existing derivative files now?"
    if res == true
      FileUtils.rm derivative_files
      print "Deleted #{derivative_files.size} derivative files from \"#{config[:thumb_images_dir]}\" and/or \"#{config[:small_images_dir]}\". Remember to rerun the generate_derivatives rake task.\n"
    end
  end

end


###############################################################################
# extract_pdf_text
###############################################################################

desc "Extract the text from PDF collection objects"
task :extract_pdf_text do

  config = load_config :DEVELOPMENT
  output_dir = config[:extracted_pdf_text_dir]
  $ensure_dir_exists.call output_dir

  # Extract the text.
  num_items = 0
  Dir.glob(File.join([config[:objects_dir], "*.pdf"])).each do |filename|
    output_filename = File.join(
      [output_dir, "#{File.basename(filename, File.extname(filename))}.txt"]
    )
    system("pdftotext -enc UTF-8 -eol unix -nopgbrk #{filename} #{output_filename}")
    num_items += 1
  end
  puts "Extracted text from #{num_items} PDFs into: #{output_dir}"
end


###############################################################################
# generate_es_bulk_data
###############################################################################

desc "Generate the file that we'll use to populate the Elasticsearch index via the Bulk API"
task :generate_es_bulk_data, [:env] do |t, args|
  args.with_defaults(
    :env => "DEVELOPMENT"
  )
  assert_env_arg_is_valid args.env
  env = args.env.to_sym

  config = load_config env

  # Get the development config for local directory info.
  dev_config = load_config :DEVELOPMENT

  # Create a search config <fieldName> => <configDict> map.
  field_config_map = {}
  dev_config[:search_config].each do |row|
    field_config_map[row['field']] = row
  end

  output_dir = dev_config[:elasticsearch_dir]
  $ensure_dir_exists.call output_dir
  output_path = File.join([output_dir, $ES_BULK_DATA_FILENAME])
  output_file = File.open(output_path, mode: "w")
  index_name = dev_config[:elasticsearch_index]
  num_items = 0
  dev_config[:metadata].each do |item|
    # Remove any fields with an empty value.
    item.delete_if { |k, v| v.nil? }

    # Split each multi-valued field value into a list of values.
    item.each do |k, v|
      if field_config_map.has_key? k and field_config_map[k]['multi-valued'] == "true"
        item[k] = (v or "").split(";").map { |s| s.strip }
      end
    end

    item['url'] = "#{config[:collection_url]}/items/#{item['objectid']}.html"
    item['collectionUrl'] = config[:collection_url]
    item['collectionTitle'] = config[:collection_title]

    # Add the thumbnail image URL.
    if env == :DEVELOPMENT
      item['thumbnailContentUrl'] = "#{File.join(config[:thumb_images_dir], item['objectid'])}_th.jpg"
    else
      item['thumbnailContentUrl'] = "#{config[:remote_thumb_images_url]}/#{item['objectid']}_th.jpg"
    end

    # If a extracted text file exists for the item, add the content of that file to the item
    # as the "full_text" property.
    item_text_path = File.join([dev_config[:extracted_pdf_text_dir], "#{item['objectid']}.txt"])
    if File::exists? item_text_path
      full_text = File.read(item_text_path, mode: "r", encoding: "utf-8")
      item['full_text'] = full_text
    end

    # Write the action_and_meta_data line.
    doc_id = item['objectid']
    output_file.write("{\"index\": {\"_index\": \"#{index_name}\", \"_id\": \"#{doc_id}\"}}\n")

    # Write the source line.
    output_file.write("#{JSON.dump(item.to_hash)}\n")

    num_items += 1
  end

  puts "Wrote #{num_items} items to: #{output_path}"
end


###############################################################################
# generate_es_index_settings
###############################################################################

"""
Generate a file that comprises the Mapping settings for the Elasticsearch index
from the configuration specified in _data/config.search.yml

https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html
"""

desc "Generate the settings file that we'll use to create the Elasticsearch index"
task :generate_es_index_settings do
  TEXT_FIELD_DEF_KEYS = [ 'field' ]
  BOOL_FIELD_DEF_KEYS = [ 'index', 'display', 'facet', 'multi-valued' ]
  VALID_FIELD_DEF_KEYS = TEXT_FIELD_DEF_KEYS.dup.concat BOOL_FIELD_DEF_KEYS
  INDEX_SETTINGS_TEMPLATE = {
    mappings: {
      dynamic_templates: [
        {
          store_as_unindexed_text: {
            match_mapping_type: "*",
            mapping: {
              type: "text",
              index: false
            }
          }
        }
      ],
      properties: {
        # Define the set of static properties.
        objectid: {
          type: "text",
          index: false
        },
        url: {
          type: "text",
          index: false,
        },
        thumbnailContentUrl: {
          type: "text",
          index: false,
        },
        collectionTitle: {
          type: "text",
          index: false,
        },
        collectionUrl: {
          type: "text",
          index: false,
        }
      }
    }
  }

  def assert_field_def_is_valid field_def
    # Assert that the field definition is valid.
    keys = field_def.to_hash.keys

    missing_keys = VALID_FIELD_DEF_KEYS.reject { |k| keys.include? k }
    extra_keys = keys.reject { |k| VALID_FIELD_DEF_KEYS.include? k }
    if !missing_keys.empty? or !extra_keys.empty?
      msg = "The field definition: #{field_def}"
      if !missing_keys.empty?
        msg = "#{msg}\nis missing the required keys: #{missing_keys}"
      end
      if !extra_keys.empty?
        msg = "#{msg}\nincludes the unexpected keys: #{extra_keys}"
      end
      raise msg
    end

    invalid_bool_value_keys = BOOL_FIELD_DEF_KEYS.reject { |k| ['true', 'false'].include? field_def[k] }
    if !invalid_bool_value_keys.empty?
      raise "Expected true/false value for: #{invalid_bool_value_keys.join(", ")}"
    end

    if field_def['index'] == "false" and
      (field_def['facet'] == "true" or field_def['multi-valued'] == "true")
      raise "Field (#{field_def['field']}) has index=false but other index-related "\
            "fields (e.g. facet, multi-valued) specified as true"
    end

    if field_def['multi-valued'] == "true" and field_def['facet'] != "true"
      raise "If field (#{field_def['field']}) specifies multi-valued=true, it "\
            "also needs to specify facet=true"
    end
  end

  def convert_field_def_bools field_def
    # Do an in-place conversion of the bool strings to python bool values.
    BOOL_FIELD_DEF_KEYS.each do |k|
      field_def[k] = field_def[k] == "true"
    end
  end

  def get_mapping field_def
    # Return an ES mapping configuration object for the specified field definition.
    mapping = {
      type: "text"
    }
    if field_def['facet']
      mapping['fields'] = {
        raw: {
          type: "keyword"
        }
      }
    end
    return mapping
  end

  # Main block
  config = load_config :DEVELOPMENT

  index_settings = INDEX_SETTINGS_TEMPLATE.dup

  # Add the _meta mapping field with information about the index itself.
  index_settings[:mappings]['_meta'] = {
    :title => config[:collection_title],
    :description => config[:collection_description],
  }

  config[:search_config].each do |field_def|
    assert_field_def_is_valid(field_def)
    convert_field_def_bools(field_def)
    if field_def['index']
      index_settings[:mappings][:properties][field_def['field']] = get_mapping(field_def)
    end
  end

  output_dir = config[:elasticsearch_dir]
  $ensure_dir_exists.call output_dir
  output_path = File.join([output_dir, $ES_INDEX_SETTINGS_FILENAME])
  output_file = File.open(output_path, mode: "w")
  output_file.write(JSON.pretty_generate(index_settings))
  puts "Wrote: #{output_path}"
end


###############################################################################
# load_es_bulk_data
###############################################################################

desc "Load the collection data into the Elasticsearch index"
task :load_es_bulk_data, [:es_user] do |t, args|
  args.with_defaults(
    :es_user => nil,
  )

  config = $get_config_for_es_user.call args.es_user
  dev_config = load_config :DEVELOPMENT

  res = make_es_request(
    config=config,
    user=args.es_user,
    method=:POST,
    path = "/_bulk",
    body=File.open(File.join([dev_config[:elasticsearch_dir], $ES_BULK_DATA_FILENAME]), 'rb').read,
    content_type='application/x-ndjson'
  )

  if res.code != '200'
    raise res.body
  end
  puts "Loaded data into Elasticsearch"
end



###############################################################################
# create_es_snapshot_s3_repository
###############################################################################

desc "Create an Elasticsearch snapshot repository that uses S3-compatible storage"
task :create_es_snapshot_s3_repository,
     [:es_user, :bucket, :base_path, :repository_name] do |t, args|
  assert_required_args(args, [:bucket])
  args.with_defaults(
    :base_path => $ES_DEFAULT_SNAPSHOT_REPOSITORY_BASE_PATH,
    :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
  )

  config = $get_config_for_es_user.call args.es_user

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:PUT,
     path="/_snapshot/#{args.repository_name}",
     body=JSON.dump({
       :type => 's3',
       :settings => {
         :bucket => args.bucket,
         :base_path => args.base_path
       }
                    }),
    content_type=$APPLICATION_JSON
  )
  if res.code != '200'
      raise res.body
  end
  puts "Elasticsearch S3 snapshot repository (#{args.repository_name}) created"
end


###############################################################################
# delete_es_snapshot_repository
###############################################################################

desc "Delete an Elasticsearch snapshot repository"
task :delete_es_snapshot_repository, [:es_user, :repository_name] do |t, args|
  assert_required_args(args, [:repository_name])

  config = $get_config_for_es_user.call args.es_user

  repository_name = args.repository_name

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:DELETE,
     path="/_snapshot/#{repository_name}"
  )

  if res.code == '200'
    puts "Deleted Elasticsearch snapshot repository: \"#{repository_name}\""
  else
    data = JSON.load(res.body)
    if data['error']['type'] == 'repository_missing_exception'
      puts "No Elasticsearch snapshot repository found for name: \"#{repository_name}\""
    else
      raise res.body
    end
  end
end


###############################################################################
# list_es_snapshot_repositories
###############################################################################

desc "List the existing Elasticsearch snapshot repositories"
task :list_es_snapshot_repositories, [:es_user] do |t, args|
  config = $get_config_for_es_user.call args.es_user

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:GET,
     path='/_snapshot',
  )
  if res.code != '200'
      raise res.body
  end
  # Pretty-print the JSON response.
  puts JSON.pretty_generate(JSON.load(res.body))
end


###############################################################################
# create_es_snapshot
###############################################################################

desc "Create a new Elasticsearch snapshot"
task :create_es_snapshot, [:es_user, :repository_name, :wait] do |t, args|
  args.with_defaults(
    :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
    :wait => 'true'
  )
  wait = args.wait == 'true'

  config = $get_config_for_es_user.call args.es_user

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:PUT,
     path="/_snapshot/#{args.repository_name}/#{$ES_MANUAL_SNAPSHOT_NAME_TEMPLATE}",
     body=JSON.dump(
       { :indices => [ '*', '-.security*' ],
         :wait => wait,
       }
     ),
     content_type=$APPLICATION_JSON
  )
  if res.code != '200'
      raise res.body
  end
  # Pretty-print the JSON response.
  puts JSON.pretty_generate(JSON.load(res.body))
end


###############################################################################
# list_es_snapshots
###############################################################################

desc "List available Elasticsearch snapshots"
task :list_es_snapshots, [:es_user, :repository_name] do |t, args|
  args.with_defaults(
    :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
  )

  config = $get_config_for_es_user.call args.es_user

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:GET,
     path="/_snapshot/#{args.repository_name}/*"
  )
  data = JSON.load res.body
  if res.code != '200'
      raise "#{data}"
  end
  # Pretty-print the JSON response.
  puts JSON.pretty_generate(JSON.load(res.body))
end


###############################################################################
# restore_es_snapshot
###############################################################################

desc "Restore an Elasticsearch snapshot"
task :restore_es_snapshot, [:es_user, :snapshot_name, :wait, :repository_name] do |t, args|
  assert_required_args(args, [ :snapshot_name ])
  args.with_defaults(
    :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
    :wait => 'true'
  )
  wait = args.wait == 'true'

  config = $get_config_for_es_user.call args.es_user

  repository_snapshot_path = "#{args.repository_name}/#{args.snapshot_name}"

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:POST,
     path="/_snapshot/#{repository_snapshot_path}/_restore" +
          "?wait_for_completion=#{args.wait}"
  )
  if res.code != '200'
    raise res.body
  elsif wait
    puts "Snapshot (#{repository_snapshot_path}) restored"
  else
    # Pretty-print the JSON response.
    puts JSON.pretty_generate(JSON.load(res.body))
  end
end


###############################################################################
# delete_es_snapshot
###############################################################################

desc "Delete an Elasticsearch snapshot"
task :delete_es_snapshot, [:es_user, :snapshot_name, :repository_name] do |t, args|
  assert_required_args(args, [:snapshot_name])
  args.with_defaults(
    :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
  )

  config = $get_config_for_es_user.call args.es_user

  snapshot_name = args.snapshot_name

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:DELETE,
     path="/_snapshot/#{args.repository_name}/#{snapshot_name}"
  )

  if res.code == '200'
    puts "Deleted Elasticsearch snapshot: \"#{snapshot_name}\""
  else
    data = JSON.load(res.body)
    if data['error']['type'] == 'snapshot_missing_exception'
      puts "No Elasticsearch snapshot found for name: \"#{snapshot_name}\""
    else
      raise res.body
    end
  end
end


###############################################################################
# create_es_snapshot_policy
###############################################################################

desc "Create a policy to enable automatic Elasticsearch snapshots"
task :create_es_snapshot_policy, [:es_user, :policy_name, :repository_name, :schedule] do |t, args|
  # https://www.elastic.co/guide/en/elasticsearch/reference/current/cron-expressions.html
  CRON_DAILY_AT_MIDNIGHT = '0 0 0 * * ?'

  args.with_defaults(
    :policy_name => $ES_DEFAULT_SNAPSHOT_POLICY_NAME,
    :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
    :schedule => CRON_DAILY_AT_MIDNIGHT
  )

  config = $get_config_for_es_user.call args.es_user

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:PUT,
     path="/_slm/policy/#{args.policy_name}",
     body=JSON.dump(
       {:schedule => args.schedule,
        :name => $ES_SCHEDULED_SNAPSHOT_NAME_TEMPLATE,
        :repository => args.repository_name,
        :config => { :indices => [ '*', '-.security*' ] },
        :rentention => {
          :expire_after => '30d',
          :min_count => 5,
          :max_count => 50
        }
       }
     ),
     content_type=$APPLICATION_JSON
  )

  if res.code != '200'
    raise res.body
  end
  puts "Elasticsearch snapshot policy (#{args.policy_name}) created"
end


###############################################################################
# execute_es_snapshot_policy
###############################################################################

desc "Manually execute an existing Elasticsearch snapshot policy"
task :execute_es_snapshot_policy, [:es_user, :policy_name, :repository_name] do |t, args|
  args.with_defaults(
    :policy_name => $ES_DEFAULT_SNAPSHOT_POLICY_NAME,
    :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME,
  )

  config = $get_config_for_es_user.call args.es_user

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:POST,
     path="/_slm/policy/#{args.policy_name}/_execute"
  )

  if res.code != '200'
    raise res.body
  end
  puts "Elasticsearch snapshot policy (#{args.policy_name}) was executed.\n" +
       "Run \"rake list_es_snapshot_policies[#{args.es_user}]\" to check its status."
end


###############################################################################
# list_es_snapshot_policies
###############################################################################

desc "List the currently-defined Elasticsearch snapshot policies"
task :list_es_snapshot_policies, [:es_user, :repository_name] do |t, args|
  args.with_defaults(
    :repository_name => $ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME
  )

  config = $get_config_for_es_user.call args.es_user

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:GET,
     path="/_slm/policy"
  )
  data = JSON.load res.body
  if res.code != '200'
      raise "#{data}"
  end
  # Pretty-print the JSON response.
  puts JSON.pretty_generate(JSON.load(res.body))
end


###############################################################################
# delete_es_snapshot_policy
###############################################################################

desc "Delete an Elasticsearch snapshot policy"
task :delete_es_snapshot_policy, [:es_user, :policy_name] do |t, args|
  args.with_defaults(
    :policy_name => $ES_DEFAULT_SNAPSHOT_POLICY_NAME,
  )

  config = $get_config_for_es_user.call args.es_user

  policy_name = args.policy_name

  res = make_es_request(
     config=config,
     user=args.es_user,
     method=:DELETE,
     path="/_slm/policy/#{policy_name}"
  )

  if res.code == '200'
    puts "Deleted Elasticsearch snapshot policy: \"#{policy_name}\""
  else
    data = JSON.load(res.body)
    if data['error']['type'] == 'resource_not_found_exception'
      puts "No Elasticsearch snapshot policy found for name: \"#{policy_name}\""
    else
      raise res.body
    end
  end
end


###############################################################################
# enable_es_daily_snapshots
###############################################################################

desc "Enable daily Elasticsearch snapshots to be written to the \"#{$ES_DEFAULT_SNAPSHOT_REPOSITORY_BASE_PATH}\" directory of your Digital Ocean Space."
task :enable_es_daily_snapshots, [:es_user] do |t, args|
  # Check that the user has already completed the server-side configuration.
  if !prompt_user_for_confirmation "Did you already run the configure-s3-snapshots script on the Elasticsearch instance?"
    puts "Please see the README for instructions on how to run the configure-s3-snapshots script."
    exit 1
  end

  es_user = args.es_user

  config = $get_config_for_es_user.call es_user

  # Assert that the specified user is associated with a production config.
  if !config.has_key? :remote_objects_url
    puts "Please specify a production ES user"
  end

  # Get the Digital Ocean Space bucket value.
  bucket = parse_digitalocean_space_url(config[:remote_objects_url])[0]

  # Create the S3 snapshot repository.
  Rake::Task['create_es_snapshot_s3_repository'].invoke(es_user, bucket)

  # Create the automatic snapshot policy.
  Rake::Task['create_es_snapshot_policy'].invoke(es_user)

  # Manually execute the policy to test it.
  puts "Manually executing the snapshot policy to ensure that it works..."
  Rake::Task['execute_es_snapshot_policy'].invoke(es_user)
end


###############################################################################
# setup_elasticsearch
###############################################################################

task :setup_elasticsearch do
  Rake::Task['extract_pdf_text'].invoke
  Rake::Task['generate_es_bulk_data'].invoke
  Rake::Task['generate_es_index_settings'].invoke

  # Wait for the Elasticsearch instance to be ready.
  config = load_config :DEVELOPMENT
  while ! elasticsearch_ready config
    puts 'Waiting for Elasticsearch... Is it running?'
    sleep 2
  end

  # TODO - figure out why the index mapping in not right when these two tasks
  # (create_es_index, load_es_bulk_data) are executed within this task but work
  # fine when executed individually using rake.
  Rake::Task['create_es_index'].invoke
  Rake::Task['load_es_bulk_data'].invoke
end


###############################################################################
# sync_objects
#
# Upload objects from your local objects/ dir to a Digital Ocean Space or other
# S3-compatible storage.
# For information on how to configure your credentials, see:
# https://docs.aws.amazon.com/sdk-for-ruby/v3/developer-guide/setup-config.html#aws-ruby-sdk-credentials-shared
#
###############################################################################

task :sync_objects, [ :aws_profile ] do |t, args |
  args.with_defaults(
    :aws_profile => "default"
  )

  # Get the local objects directories from the development configuration.
  dev_config = load_config :DEVELOPMENT
  objects_dir = dev_config[:objects_dir]
  thumb_images_dir = dev_config[:thumb_images_dir]
  small_images_dir = dev_config[:small_images_dir]

  # Parse the S3 components from the remove_objects_url.
  s3_url = load_config(:PRODUCTION_PREVIEW)[:remote_objects_url]
  bucket, region, prefix, endpoint = parse_digitalocean_space_url s3_url

  # Create the S3 client.
  credentials = Aws::SharedCredentials.new(profile_name: args.aws_profile)
  s3_client = Aws::S3::Client.new(
    endpoint: endpoint,
    region: region,
    credentials: credentials
  )

  # Iterate over the object files and put each into the remote bucket.
  num_objects = 0
  [ objects_dir, thumb_images_dir, small_images_dir ].each do |dir|
    # Enforce a requirement by the subsequent object key generation code that each
    # enumerated directory path starts with objects_dir.
    if !dir.start_with? objects_dir
      raise "Expected dir to start with \"#{objects_dir}\", got: \"#{dir}\""
    end

    Dir.glob(File.join([dir, '*'])).each do |filename|
      # Ignore subdirectories.
      if File.directory? filename
        next
      end

      # Generate the remote object key using any specified digital-objects prefix and the
      # location of the local file relative to the objects dir.
      key = "#{prefix}/#{dir[objects_dir.length..]}/#{File.basename(filename)}"
              .gsub('//', '/')
              .delete_prefix('/')

      puts "Uploading \"#{filename}\" as \"#{key}\"..."
      s3_client.put_object(
        bucket: bucket,
        key: key,
        body: File.open(filename, 'rb'),
        acl: 'public-read'
      )

      num_objects += 1
    end
  end

  puts "Uploaded #{num_objects} objects"

end
