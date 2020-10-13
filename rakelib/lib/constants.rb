
# This file defines all of the constants and default configuration values used
# by the various rake tasks.

require "cgi"


###############################################################################
# Configuration - customize these values to suit your application
###############################################################################

$ENV_CONFIG_FILENAMES_MAP = {
  :DEVELOPMENT => [ '_config.yml' ],
  :PRODUCTION_PREVIEW => [ '_config.yml', '_config.production_preview.yml' ],
  :PRODUCTION => [ '_config.yml', '_config.production.yml' ],
}

$ES_BULK_DATA_FILENAME = 'es_bulk_data.jsonl'

$ES_CREDENTIALS_PATH = File.join [Dir.home, ".elasticsearch", "credentials"]

$ES_DEFAULT_SNAPSHOT_REPOSITORY_BASE_PATH = '_elasticsearch_snapshots'

$ES_DEFAULT_SNAPSHOT_REPOSITORY_NAME = 'default'

$ES_DIRECTORY_INDEX_SETTINGS = {
  :mappings => {
    :properties => {
      :index => {
        :type => "text",
        :index => false,
      },
      :title => {
        :type => "text",
        :index => false,
      },
      :description => {
        :type => "text",
        :index => false,
      },
      :doc_count => {
        :type => "integer",
        :index => false,
      }
    }
  }
}

# Define an Elasticsearch snapshot name template that will automatically include the current date and time.
# See: https://www.elastic.co/guide/en/elasticsearch/reference/current/date-math-index-names.html#date-math-index-names
$ES_MANUAL_SNAPSHOT_NAME_TEMPLATE = CGI.escape "<manual-snapshot-{now/d{yyyyMMdd-HHmmss}}>"

$ES_INDEX_SETTINGS_FILENAME = 'es_index_settings.json'

$SEARCH_CONFIG_PATH = File.join(['_data', 'config-search.csv'])


###############################################################################
# Constants - these values should not be modified
###############################################################################

$APPLICATION_JSON = 'application/json'
