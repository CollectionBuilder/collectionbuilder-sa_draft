

$APPLICATION_JSON = 'application/json'

$ENV_CONFIG_FILENAMES_MAP = {
  :DEVELOPMENT => [ '_config.yml' ],
  :PRODUCTION_PREVIEW => [ '_config.yml', '_config.production_preview.yml' ],
  :PRODUCTION => [ '_config.yml', '_config.production.yml' ],
}

$ES_CREDENTIALS_PATH = File.join [Dir.home, ".elasticsearch", "credentials"]

$SEARCH_CONFIG_PATH = File.join(['_data', 'config-search.csv'])
