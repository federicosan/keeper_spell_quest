const { IS_RESTARTING } = require('../game/state')
const { homecoming } = require('../game/homecoming')
const { vote } = require('../game/vote')
const { objects } = require('../spells/objects')
const { server } = require('../server')

exports.handleReaction = async function(reaction, user) {
  try {
    let handled = await homecoming.addReaction(reaction, user)
    if (handled) {
      return
    }
  } catch (error) {
    console.log(error)
  }
  if (IS_RESTARTING && !server.isAdmin(user.id)) {
    return
  }
  try {
    let handled = await vote.addReaction(server, reaction, user)
    if (handled) {
      return
    }
  } catch (error) {
    console.log(error)
  }
  try {
    let handled = await objects.addReaction(reaction, user)
    if (handled) {
      return
    }
  } catch (error) {
    console.log(error)
  }
  if (reaction._emoji.id == "976203184802496562" && user.id != "974842656372953118" && reaction.message.channelId == "978078135193071657") {
    reaction.users.remove(user.id)
  }
}