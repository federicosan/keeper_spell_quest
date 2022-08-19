const { creatures } = require('./creatures')
const { objects } = require('./objects')
const { cache } = require('./types/cache')

exports.spells_game = {
  init: async (server) => {
    await creatures.init(server)
    await objects.init()
  },
  run: async (server) => {
    cache.run()
    creatures.run(server)
    objects.run()
  },
}