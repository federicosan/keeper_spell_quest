const { Client, Intents, MessageEmbed } = require('discord.js')

const { server } = require('../server')
const { message } = require('./message')
const { vote } = require('../game/vote')
const { welcome } = require('../discord/welcome')
const { handleReaction } = require('./reaction')
const { handleJoin } = require('../game/recruit')
const { interactionHandler } = require('./interaction')
const { updateAllStats } = require('../game/stats')
const { IS_RESTARTING } = require('../game/state')
const { run } = require('forever/lib/forever/cli')


var TRIGGER_MODE = {
  none: 0,
  commands: 1,
  members: 2,
  messages: 4,
  logs: 8
}

function _client() {
  return new Client({
    intents: [
      Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS,
      Intents.FLAGS.DIRECT_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS],
    partials: ['CHANNEL', 'REACTION']
  })
}

class KeeperClient {
  constructor(token, mode, readyCallback) {
    this.client = _client()
    this.token = token
    this.mode = mode
    this.ready = false
    this.readyCallback = readyCallback
    this.setTriggers()
  }
  
  setReadyCallback(f) {
    this.readyCallback = f
  }
  
  async start() {
    await this.client.login(this.token)
  }
  
  setCommandTriggers() {
    this.client.on('interactionCreate', async interaction => {
      if (IS_RESTARTING && !server.isAdmin(interaction.member.id)) {
        return
      }
      try {
        await interactionHandler.handle(server, interaction)
      } catch(err){
        console.log(err)
      }
    })
  }
  
  setMemberTriggers() {
    this.client.on("guildMemberUpdate", async function(oldMember, newMember) {
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
            await _cult.addPoints(server.kvstore, `cult:members`, -1)
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
      await cult.addPoints(server.kvstore, `cult:members`, 1)
      // TODO: enable once we switch to cult chant system
      try {
        await handleJoin(server, newMember)
      } catch (error) {
        console.log(error)
      }
      updateAllStats(cult)
    })
    this.client.on('guildMemberAdd', async (member) => {
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
  }
  
  setMessageTriggers() {
    this.client.on('messageCreate', async (msg) => {
      if (IS_RESTARTING && !server.isAdmin(msg.member.id)) {
        if (msg.channel.id == '1007018715474313216' && msg.type != "REPLY") {
          msg.react(server.Emojis.AYE)
          msg.react(server.Emojis.NAY)
          return
        }
        return
      }
      message.handle(msg)
    })
    this.client.on('messageDelete', async (msg) => {
      let handled = await vote.handleMessageDelete(server, msg)
      if (handled) {
        return
      }
    })
    this.client.on('messageReactionAdd', async (reaction, user) => {
      handleReaction(reaction, user)
    })
    this.client.on('messageReactionRemove', async (reaction, user) => {
      if (IS_RESTARTING && !server.isAdmin(user.id)) {
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
  }
  
  setLogTriggers() {
    this.client.on('shardError', (err) => {
      console.log("ERROR:", err)
    })

    this.client.on('warn', (err) => {
      console.log("WARN:", err)
    })

    this.client.on('rateLimit', data => {
      console.log('Rate Limit Hit!');
      console.log(data);
    })
  }
  
  setTriggers() {
    if(this.mode & TRIGGER_MODE.commands) {
      this.setCommandTriggers()
    }
    if(this.mode & TRIGGER_MODE.members) {
      this.setMemberTriggers()
    }
    if(this.mode & TRIGGER_MODE.messages) {
      this.setMessageTriggers()
    }
    if(this.mode & TRIGGER_MODE.logs) {
      this.setLogTriggers()
    }
    this.client.once('ready', async () => {
      this.ready = true
      if(this.readyCallback){
        this.readyCallback()
      }
    })
  }
}


class KeeperClients{
  constructor(allReadyCallback) {
    this._clients = clients
    
    const readyCallback = async () => {      
      for(const client of this._clients){
        if(!client.ready){
          return
        }
      }
      this.allReadyCallback()
    }
    for(const client of this._clients) {
      client.setReadyCallback(readyCallback)
    }
    // Called when all clients are ready
    this.allReadyCallback = allReadyCallback
  }
  
  async start() {
    for (const client of this._clients) {
      await client.start()
    }
  }  
}

var clients;

function init(_clients, allReadyCallback){
  // clients = KeeperClients(
  //   [
  //     new KeeperClient(_client(),process.env.TOKEN , TRIGGER_MODE.commands | TRIGGER_MODE.members | TRIGGER_MODE.messages | TRIGGER_MODE.logs),
  //     new KeeperClient(_client(),process.env.TOKEN_2, TRIGGER_MODE.none)
  //   ],
  //   allReadyCallback,
  // )
  clients = _clients
  const readyCallback = async () => {      
    for(const client of clients){
      if(!client.ready){
        return
      }
    }
    allReadyCallback()
  }
  for(const client of clients) {
    client.setReadyCallback(readyCallback)
  }
  server.setClient(clients[0].client)
}

async function start(){
  for (const client of clients) {
    await client.start()
  }
}

exports.TRIGGER_MODE = TRIGGER_MODE
exports.KeeperClient = KeeperClient
exports.clients = {
  init: init,
  start: start,
  getAll: () => clients,
  get: (i = -1) => {
    if(i>=0){
      return clients[i]
    } 
    return clients[Math.floor(Math.random()* clients.length)]
  }
}