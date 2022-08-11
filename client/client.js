const { Client, Intents, MessageEmbed } = require('discord.js')

const { server } = require('../server')
const { message } = require('./message')
const { vote } = require('../vote')
const { welcome } = require('../welcome')
const { handleReaction } = require('../reaction')
const { handleJoin } = require('../recruit')
const { interactionHandler } = require('../interaction')
const { objects } = require('../spells/objects')
const { homecoming } = require('../game/homecoming')
const { updateAllStats } = require('../stats')
const { IS_RESTARTING } = require('../game/state')

var client = new Client({
  intents: [
    Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS],
  partials: ['CHANNEL', 'REACTION']
});

server.setClient(client)

function setClientTriggers() {
  client.on('messageCreate', async (msg) => {
    if (IS_RESTARTING && !server.admins.includes(msg.member.id)) {
      if (msg.channel.id == '1007018715474313216' && msg.type != "REPLY") {
        msg.react(server.Emojis.AYE)
        msg.react(server.Emojis.NAY)
        return
      }
      return
    }
    message.handle(msg)
  })

  client.on('messageDelete', async (msg) => {
    let handled = await vote.handleMessageDelete(server, msg)
    if (handled) {
      return
    }
  })

  client.on("guildMemberUpdate", async function(oldMember, newMember) {
    if (IS_RESTARTING) {
      return
    }
    console.error(`a guild member changes - i.e. new role, removed role, nickname.`);
    let cult;
    for (const [key, _cult] of server.Cults.entries()) {
      if (newMember.roles.cache.has(_cult.roleId)) {
        cult = _cult
        break
      }
    }
    if (!cult) {
      // handle cult removal
      let didUpdate = false
      for (const [key, _cult] of server.Cults.entries()) {
        if (oldMember.roles.cache.has(_cult.roleId)) {
          await _cult.addPoints(server.database, `cult:members`, -1)
          didUpdate = true
        }
      }
      if (didUpdate) {
        updateAllStats()
      }
      return
    }
    if (oldMember.roles.cache.has(cult.roleId)) {
      return
    }
    await cult.addPoints(server.database, `cult:members`, 1)
    // TODO: enable once we switch to cult chant system
    try {
      await handleJoin(server, newMember)
    } catch (error) {
      console.log(error)
    }
    updateAllStats(cult)
  })

  client.on('guildMemberAdd', async (member) => {
    if (IS_RESTARTING) {
      member.roles.add(server.Roles.Lost)
      return
    }
    try {
      await handleJoin(server, member)
    } catch (error) {
      console.log(error)
    }
    await welcome(server, member)
  })

  client.on('messageReactionAdd', async (reaction, user) => {
    try {
      let handled = await homecoming.addReaction(reaction, user)
      if (handled) {
        return
      }
    } catch (error) {
      console.log(error)
    }
    if (IS_RESTARTING && !server.admins.includes(user.id)) {
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
    handleReaction(reaction, user)

  })

  client.on('messageReactionRemove', async (reaction, user) => {
    if (IS_RESTARTING && !server.admins.includes(user.id)) {
      return
    }
    try {
      let handled = await vote.removeReaction(server, reaction, user)
      if (handled) {
        return
      }
    } catch (error) {
      console.log(error)
    }
  })

  client.on('interactionCreate', async interaction => {
    if (IS_RESTARTING && !server.admins.includes(interaction.member.id)) {
      return
    }
    await interactionHandler.handle(server, interaction)
  })

  client.on('shardError', (err) => {
    console.log("ERROR:", err)
  })

  client.on('warn', (err) => {
    console.log("WARN:", err)
  })

  client.on('rateLimit', data => {
    console.log('Rate Limit Hit!');
    console.log(data);
  })
}


exports.setClientTriggers = setClientTriggers
exports.client = client