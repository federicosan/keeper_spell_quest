const { MessageEmbed } = require('discord.js')
const moment = require('moment')

const { RateLimiter } = require('../utils/ratelimit')
const { StringMutex } = require('../utils/mutex')
const { User } = require('../types/user')
const { server } = require('../server')
const { points } = require('../spells/points')
const { vote } = require('../game/vote')
const { handleJoin } = require('../game/recruit')
const { bees } = require('../spells/bees')
const { updateAllStats, leaderboard } = require('../game/stats')
const { FREEZE_TYPE } = require('../spells/constants')
const { fragments } = require('../spells/fragments')
const { homecoming } = require('../game/homecoming')

const EPOCH_PERIOD = 6 * 60 * 60 * 1000

var chantReactionLimiter = new RateLimiter(4, 60 * 1000)
var UserMutex = new StringMutex()
async function handleChant(msg, noReply) {
  console.log("msg:", msg)
  var cult
  if (msg.member) {
    cult = server.Cults.userCult(msg.member)
  } else {
    cult = server.userIdCult(msg.author.id)
  }
  if (!cult) {
    if (!server.isAdmin(msg.member.id)) {
      console.log("no cult for author found:", msg.member.id)
    }
    return
  }
  console.log("cult:", cult, "msg content:", msg.content.toLowerCase())
  if (msg.content.toLowerCase() != cult.chant) {
    if (msg.content.toLowerCase().startsWith(cult.chant)) {
      msg.channel.send(`${msg.author} your chant is impure, the ancients reject it`).catch(console.error)
      return
    }
    return
  }
  if (msg.channel.id != server.AltarChannelId) {
    msg.reply("the altar has moved, chant in " + msg.guild.channels.cache.get(server.AltarChannelId).toString())
    return
  }
  var release = await UserMutex.acquire(msg.author.id)
  try{
    let user = await server.getUser(msg.author.id) 
    if (!user) {
      let embed = new MessageEmbed()
        .setTitle("bind to begin chanting <:magic:975922950551244871>")
        .setColor("#FFFFE0")
        .setURL('https://spells.quest/bind')
        .setDescription(`you must [**bind**](https://spells.quest/bind) to earn magic <:magic:975922950551244871>\nyou must earn <:magic:975922950551244871> to conjure spells <:rare_shard:982122044617551882>`)
        .addField('binding', 'one click auth with discord so @keeper can connect your wallet to your profile. [go here](https://spells.quest/bind) and click the 🗡')
        .addField('why lil ol\' me? <:isforme:986732126332420136>', 'you are a good and early zealot. all new cultists are automatically bound when they join')
        .setFooter({ text: '​', iconURL: 'https://cdn.discordapp.com/emojis/975977080699379712.webp?size=96&quality=lossless' })
      msg.reply({ embeds: [embed] }).catch(console.error)
      return
    }
    
    let lastCheckpoint = Date.now() - (Date.now() - 4 * 60 * 60 * 1000) % EPOCH_PERIOD
    if (lastCheckpoint < await user.lastChantedAt(server)) {
      // send cant chant yet message
      if (!noReply) {
        msg.reply({ content: `${msg.author} you may only chant once every ${moment.duration(EPOCH_PERIOD).humanize()}` }).catch(console.error)
      } else {
        console.log("already logged chant, returning")
        chantReactionLimiter.try(() => {
          try {
            msg.react('976203184802496562')
          } catch (error) {
            console.log("chant error:", error)
          }
        })
        chantReactionLimiter.try(() => {
          try {
            msg.react(cult.emojiId ? cult.emojiId : cult.emoji)
          } catch (error) {
            console.log("chant error:", error)
          }
        })
      }
      return
    }
    console.log("handling chant from author:", msg.author.id, "chant db-user id:", user ? user.discord.userid : null)
    
    await points.handleChant(server, user)
    
    if (server.isAdmin(msg.author.id)) {
      return
    }
    
    await server.kvstore.increment(`cult:${cult.id}`, 1)
    let boost = await points.getActiveCultBoost(server, msg.author.id)
    console.log("boost:", boost)
    if (boost) {
      await cult.incrementBonusPoints(server.kvstore, boost - 1)
    }
    // react
    chantReactionLimiter.try(() => {
      try {
        msg.react('976203184802496562')
      } catch (error) {
        console.log("chant error:", error)
      }
    })
    chantReactionLimiter.try(() => {
      try {
        msg.react(cult.emojiId ? cult.emojiId : cult.emoji)
      } catch (error) {
        console.log("chant error:", error)
      }
    })
    try {
      updateAllStats(cult)
    } catch (error) {
      console.log("update error:", error)
    }
  } finally {
    release()
  }
}

async function forceCountMessage(channelId, msgId, noReply) {
  updateAllStats()
  // return
  let channel = server.client.channels.cache.get(channelId)
  let msg = await channel.messages.fetch(msgId)
  if (msg == null) {
    console.log("no message???")
    return
  }
  if (msg.author.bot) {
    return
  }
  if (noReply == null) {
    noReply = true
  }
  handleChant(msg, noReply)
}

async function logMissedChants(channelId, from) {
  updateAllStats()
  // return
  let channel = server.client.channels.cache.get(channelId)
  let _lastMsg = from;
  while (true) {
    let messages = await channel.messages.fetch({
      limit: 99,
      after: _lastMsg
    })
    messages = [...messages.values()]
    if (messages.length == 0) {
      break;
    }
    for (const msg of messages) {
      if (msg == null) {
        console.log("no message???")
        return
      }
      if (msg.author.bot) {
        return
      }
      handleChant(msg, true)
    }
    _lastMsg = messages[0].id
  }
}

async function replyToMsg(channelId, msgId, response) {
  let channel = server.client.channels.cache.get(channelId)
  let msg = await channel.messages.fetch(msgId)
  if (msg == null) {
    console.log("no message???")
    return
  }
  msg.reply(response)
}

async function sendMsg(channelId, content) {
  let channel = server.client.channels.cache.get(channelId)
  if (!channel) {
    console.log("channel not found")
    return
  }
  channel.send(content)
}

async function assignCult(userId, cultId) {
  if (userId == '974842656372953118') {
    return false
  }
  try {
    let cult = server.Cults.get(cultId)
    if (!cult) {
      console.log("invalid cult")
      return
    }
    await homecoming.assignCult(userId, cult)
  } catch (err) {
    console.log("assign cult error:", err)
  }
}

async function handle(msg) {
  if (msg.author.bot) {
    return
  }
  if (msg.channel.id != '998745420371083384' && await server.userIsFrozen(msg.member) && msg.interaction == null) {
    var userCult = server.Cults.userCult(msg.member)
    if (true || (userCult && msg.channel.id != userCult.id)) {
      console.log("deleting message:", msg.content, "from:", msg.member.displayName)

      msg.delete()
      let creature = await server.db.collection("creatures").findOne({ 'target.id': msg.member.id, 'type': FREEZE_TYPE })
      msg.channel.send(`abducted cultist ${msg.member} just tried to speak... free them by defeating <#${creature.channelId}> with attack spells`)
      return
    }
  }
  if (msg.content.startsWith(fragments.SUBMIT_CMD) && fragments.hasChantWordsOnly(msg.content)) {
    fragments.handleMessage(msg)
    return
  }
  if (await bees.handleMessage(msg)) {
    return
  }
  if (msg.channel.id == '1007018715474313216' && msg.type != "REPLY") {
    console.log("reacting")
    msg.react(server.Emojis.AYE)
    msg.react(server.Emojis.NAY)
    return
  }
  if (msg.channel.id == '986712037633720390' && !server.isAdmin(msg.author.id) && msg.interaction == null) {
    msg.delete()
    return
  }
  if (msg.content.startsWith("!leaderboard")) {
    leaderboard(msg)
    return
  }
  if (msg.content.startsWith("!shame")) {
    let cult = server.Cults.get(msg.channel.id)
    var response
    if (cult) {
      response = points.cultLoserboard(server, cult.id)
    } else {
      response = points.loserboard(server)
    }
    msg.reply(response)
    return
  }
  if (msg.content.startsWith("!bound")) {
    let user = await server.db.collection("users").findOne({ "discord.userid": msg.member.id })
    if (!user) {
      msg.react(server.Emojis.NAY)
      return
    }
    if (user.cult_id) {
      msg.react(server.Emojis.AYE)
    } else {
      msg.react(server.Emojis.NAY)
    }
    return
  }

  if (server.isAdmin(msg.author.id)) {
    if (msg.content.startsWith("!logChant")) {
      let messageId = msg.content.replace("!logChant ", "")
      forceCountMessage(server.AltarChannelId, messageId)
      return
    }

    if (msg.content.startsWith("!logMissedChants")) {
      let from = msg.content.replace("!logMissedChants ", "")
      logMissedChants(server.AltarChannelId, from)
      return
    }

    if (msg.content.startsWith("!pointsLogChant")) {
      let userId = msg.content.replace("!pointsLogChant ", "")
      let dbUser = await server.db.collection("users").findOne({ "discord.userid": userId })
      if (dbUser) {
        points.handleChant(server, dbUser)
      }
      return
    }
    if (msg.content.startsWith("!pointsLogRecruit")) {
      let body = msg.content.replace("!pointsLogRecruit ", "")
      let args = body.split(" ")
      console.log("args:", args)
      let dbUser = await server.db.collection("users").findOne({ "discord.userid": args[0] })
      if (dbUser) {
        points.handleRecruitment(server, dbUser, args[1])
      }
      return
    }

    if (msg.content.startsWith("!reply")) {
      let body = msg.content.replace("!reply ", "")
      let args = body.split("::")
      if (args.length == 3) {
        replyToMsg(args[0], args[1], args[2])
      }
      return
    }
    if (msg.content.startsWith("!assignCult")) {
      let body = msg.content.replaceAll("!assignCult ", "")
      body = body.replaceAll('<', '').replaceAll('>', '').replaceAll('@', '').replaceAll('&', '')
      console.log("body:", body)
      let args = body.split(" ")
      console.log("args:", args)
      if (args.length == 2) {
        assignCult(args[0], args[1])
      }
      return
    }

    if (msg.content.startsWith("!send")) {
      let body = msg.content.replace("!send ", "")
      let args = body.split("::")
      if (args.length == 2) {
        // channel, message
        sendMsg(args[0], args[1])
      }
      return
    }

    if (msg.content.startsWith("!deleteProposal") && msg.channel.id == "973760022427361322") {
      let id = msg.content.replace("!deleteProposal ", "")
      vote.deleteProposal(server, id)
      return
    }
    if (msg.content.startsWith("!registerProposal") && msg.channel.id == "973760022427361322") {
      let body = msg.content.replace("!registerProposal ", "")
      let args = body.split(" ")
      let channel = server.client.channels.cache.get(args[0])
      var _msg = await channel.messages.fetch(args[1])
      if (!_msg) {
        console.log("no message found")
        return
      }
      vote.handleMsg(server, _msg)
      return
    }
    if (msg.content.startsWith("!handleJoin")) {
      let userId = msg.content.replace("!handleJoin ", "")
      var guild = server.client.guilds.cache.get(server.Id)
      let member = guild.members.cache.get(userId)
      if (!member) {
        console.log("no member for account id:", userId)
        return
      }
      handleJoin(server, member)
      return
    }
  }

  let handled = await vote.handleMsg(server, msg)
  if (handled) {
    console.log("handled:", handled)
    return
  }
  handleChant(msg, false)
}

exports.message = {
  handle: handle,
  handleChant: handleChant
}