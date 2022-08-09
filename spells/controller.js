const { creatures } = require('./creatures')
const { objects } = require('./objects')

exports.spells_game = {
    init: async (server) => {
        await creatures.init(server)
        await objects.init()
    },
    run: async (server) => {
        creatures.run(server)
        objects.run()
    },
}