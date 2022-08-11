const fs = require('fs').promises;
const { server } = require('./server')
const { IS_RESTARTING } = require('./game/state')

class CultStats {
  constructor(cult, name, chants, population) {
    this.id = cult.id
    this.name = name
    this.emoji = cult.emoji
    this.chants = chants
    this.population = population
    this.score = population > 0 ? chants / Math.pow(population, 1.333) : 0
  }
}

var InterfaceChannelId = "970091627261620225"

var lastStatsMessages = {}
var lastCultOrder = []
var UDPATES_DISABLED = false

function setUpdatesDisabled(disabled) {
  UDPATES_DISABLED = disabled
}

async function loadStatsMessages() {
  const data = await fs.readFile("last_stats_messages.json", "utf8");
  lastStatsMessages = JSON.parse(data)
}

async function saveStatsMessages() {
  await fs.writeFile(`last_stats_messages.json`, JSON.stringify(lastStatsMessages));
}

async function getStats() {
  let _cults = []
  for (const [key, cult] of server.Cults.entries()) {
    let totalChants = await cult.countTotalChants(server.database)
    let population = await server.database.get(`cult:members:${cult.id}`, { raw: false })
    if (totalChants == null) {
      totalChants = 0;
    }
    totalChants = totalChants.toFixed(2)
    console.log("totalChants:", totalChants)
    if (IS_RESTARTING) {
      totalChants = 0
      population = 0
    }
    if (population == null) {
      population = "?"
    }
    _cults.push(new CultStats(cult, cult.getName(server), totalChants, population))
  }
  _cults.sort((a, b) => {
    if (a.score > b.score) {
      return -1
    }
    return 1
  })
  return _cults
}

async function updateCultMembershipCounts() {
  var guild = server.client.guilds.cache.get(server.Id);
  let members = await guild.members.fetch()
  counts = {}
  for (const [key, cult] of server.Cults.entries()) {
    counts[cult.id] = 0
  }
  members.each(member => {
    for (const [key, cult] of server.Cults.entries()) {
      if (member.roles.cache.has(cult.roleId) && !member.user.bot) {
        counts[cult.id]++
      }
    }
  })
  for (const [key, cult] of server.Cults.entries()) {
    console.log("cult:", cult.name, "members:", counts[cult.id])
    await server.database.set(`cult:members:${cult.id}`, counts[cult.id])
  }
}

var firstStatsTabUpdate = 0
var numStatsTabUpdates = 0

async function updateCultStatsTab(client, cult) {
  let msg = `${cult.emoji} ${cult.stats.chants}/${cult.stats.population} • ${cult.stats.score.toFixed(2)} `
  let channel = client.channels.cache.get(cult.statsChannel);
  try {
    console.log("setting channel name:", msg)
    await channel.setName(msg)
    console.log("set channel name:", msg)
  } catch (error) {
    console.log("setName error:", error)
  }
}

async function applyStatsToCults() {
  let cults = await getStats()
  server.Cults.mergeStats(cults)
}

async function updateStatsTab(cults, cult) {
  if (UDPATES_DISABLED) {
    return
  }
  if (numStatsTabUpdates > 3) {
    if (Date.now() - 10 * 60 * 1000 <= firstStatsTabUpdate) {
      return
    } else {
      firstStatsTabUpdate = Date.now()
      numStatsTabUpdates = 0
    }
  }
  numStatsTabUpdates++
  if (cult) {
    for (const _cult of cults) {
      if (_cult.id == cult.id) {
        cult.stats = _cult
      }
    }
    await updateCultStatsTab(server.client, cult)
  } else {
    server.Cults.mergeStats(cults)
    for (const _cult of cults) {
      cult = server.Cults.get(_cult.id)
      await updateCultStatsTab(server.client, cult)
    }
  }
  return
}

function getRankingMessage(cults, excludeStats) {
  let msg = "**CULT-LEADER BOARD**\n\n"
  var i = 1
  for (cult of cults) {
    if (excludeStats) {
      msg += `${i} | ${cult.emoji} ${cult.name} | score: ${(cult.score).toFixed(2)}\n`
    } else {
      msg += `${i} | ${cult.emoji}${cult.name} ${cult.chants}/${cult.population}^1.333 • score: ${(cult.score).toFixed(2)}\n`
    }
    i++
  }
  msg = msg.substring(0, msg.length - 1)
  return msg
}

async function udpateStatsMessage(cults) {
  if (UDPATES_DISABLED) {
    return
  }
  let channel = server.client.channels.cache.get(server.BeginChannelId)
  let msg = null
  if (channel.id in lastStatsMessages && lastStatsMessages[channel.id] != null) {
    try {
      msg = await channel.messages.fetch(lastStatsMessages[channel.id])
    } catch (error) {
      console.log(error)
    }
  }
  if (msg) {
    msg.edit(".\n\n" + getRankingMessage(cults, false))
  } else {
    let message = await channel.send(".\n" + getRankingMessage(cults, true))
    lastStatsMessages[channel.id] = message.id
    // saveStatsMessages()
  }
}

async function udpateInterfaceStatsMessage(client, cults) {
  return
  let channel = client.channels.cache.get(InterfaceChannelId)
  let msg = null
  if (channel.id in lastStatsMessages && lastStatsMessages[channel.id] != null) {
    msg = await channel.messages.fetch(lastStatsMessages[channel.id])
  }
  let newContent = getRankingMessage(cults)
  console.log("interface message:", msg)
  if (msg.content == newContent) {
    console.log("no interface stats message content change")
    return
  }
  let message = await channel.send(newContent)
  if (msg) msg.delete()
  lastStatsMessages[channel.id] = message.id
  // saveStatsMessages()
}

async function updateBotStatus(client, cults) {
  let msg = ""
  for (cult of cults) {
    msg += `${cult.emoji}${cult.score.toFixed(2)} `
  }
  client.user.setActivity(msg, { type: 'PLAYING' })
}

async function updateAllStats(cult) {
  if (UDPATES_DISABLED) {
    return
  }
  console.log("getting stats...")
  let cults = await getStats()
  console.log("got stats")
  if (lastCultOrder.length > 0) {
    let channel = server.client.channels.cache.get(InterfaceChannelId)
    if (lastCultOrder[0].id != cults[0].id) {
      channel.send(`<@&${server.Cults.get(cults[0].id).roleId}> is the new leader <:magic:975922950551244871>\n\n${getRankingMessage(cults)}`)
    } else if (lastCultOrder[1].id != cults[1].id) {
      channel.send(` 
<@&${server.Cults.get(cults[1].id).roleId}> has overtaken <@&${server.Cults.get(cults[2].id).roleId}>\n\n${getRankingMessage(cults)}`)
    }
  }
  lastCultOrder = cults
  console.log("updateStatsTab...")
  updateStatsTab(cults, cult)
  console.log("udpateStatsMessage...")
  await udpateStatsMessage(cults)
  await udpateInterfaceStatsMessage(server.client, cults)
  await saveStatsMessages()
  updateBotStatus(server.client, cults)
}

exports.getStats = getStats
exports.updateAllStats = updateAllStats
exports.init = async function() {
  await loadStatsMessages()
  console.log("loaded stats messages")
  await updateCultMembershipCounts()
  console.log("updated membership counts")
  await updateAllStats()
  console.log("updated all stats")
}

exports.stats = {
  init: exports.init,
  getStats: getStats,
  updateAllStats: updateAllStats,
  applyStatsToCults: applyStatsToCults,
  updateCultMembershipCounts: updateCultMembershipCounts,
  setUpdatesDisabled: setUpdatesDisabled
}