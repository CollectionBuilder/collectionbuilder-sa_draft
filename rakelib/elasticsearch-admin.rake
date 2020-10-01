
require_relative 'config-helpers'
require_relative 'elasticsearch-helpers'


###############################################################################
# list_es_indices
###############################################################################

desc "Pretty-print the list of existing indices to the console"
task :list_es_indices, [:profile] do |t, args|
  res = cat_indices args.profile
  puts JSON.pretty_generate(JSON.load(res.body))
end
