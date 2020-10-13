
# This file defines all of the constants and default configuration values used
# by the various rake tasks.


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

$SEARCH_CONFIG_PATH = File.join(['_data', 'config-search.csv'])


###############################################################################
# Constants - these values should not be modified
###############################################################################

$APPLICATION_JSON = 'application/json'
