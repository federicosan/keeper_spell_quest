const {
  SABOTAGE_POINTS,
  RECRUIT_CULT_POINTS,
  FRAGMENTS_CULT_POINTS,
  FRAGMENTS_SABOTAGE_CULT_POINTS,
  FRAGMENTS_SABOTEUR_CULT_POINTS
} = require('../spells/constants.js')
const { channels } = require('../utils/channels.js')


const MAIN_CHANNEL_KEY = "main_channel"
const PROPOSAL_CHANNEL_KEY = "proposal_channel"
const CHEST_CHANNEL_KEY = "chest_channel"
const FRAGMENTS_CHANNEL_KEY = "fragments_channel"

class Cult {
  constructor(name, id, chant, emoji, discordEmoji, roleId, statsChannel, proposalsChannel, channels, emojiId, bonusPoints) {
    this.name = name
    this.id = id
    this.chant = chant
    this.emoji = emoji
    this.discordEmoji = discordEmoji
    this.roleId = roleId
    this.statsChannel = statsChannel
    this.proposalsChannel = proposalsChannel
    this.channels = channels
    this.emojiId = emojiId
    this.bonusPoints = bonusPoints
  }
  
  async init(server, readOnly = false) {
    await this.loadEmoji(server.kvstore)
    // ensure role created
    if(readOnly){
      await channels.loadCultChannels(server, this)
      await channels.loadCultDungeon(server, this)
    } else {
      await channels.upsertCultChannels(server, this)
      // ensure channel
      await channels.upsertCultDungeon(server, this)
    }
  }
  
  async loadEmoji(kvstore) {
    let emoji = await kvstore.get(`cult:emoji:${this.id}`)
    if (emoji) {
      console.log("CULT EMOJI:", emoji)
      this.emoji = emoji
      this.discordEmoji = emoji
    }
  }
  
  async delete(server) {
    // TODO: allow cult channels to be deleted
  }

  getName(server) {
    let role = this.getRole(server)
    return role.name
  }

  async getMetrics(server) {
    let population = await server.db.collection("users").count({ cult_id: this.id, onboarded: true, in_server: { $ne: false } })
    let points = 0
    let agg = await server.db.collection("users").aggregate([
      {
        $match: {
          "cult_id": this.id,
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$points"
          }
        }
      }
    ])
    if (agg) {
      let c = await agg.next()
      if (c) {
        points = c.total
      }
    }
    return {
      population: population,
      points: points
    }
  }

  async channel(server) {
    return server.client.channels.cache.get(this.channels.main)
  }

  getRole(server) {
    let guild = server.client.guilds.cache.get(server.Id);
    return guild.roles.cache.get(this.roleId)
  }

  async countMembers(server) {
    let role = this.getRole(server)
    return role.members.size
  }

  async saveEmoji(kvstore) {
    await kvstore.set(`cult:emoji:${this.id}`, this.emoji)
  }

  async getPoints(kvstore, key) {
    var points = await kvstore.get(`${key}:${this.id}`)
    if (points == null) {
      points = 0;
    }
    return points
  }

  async addPoints(kvstore, key, amount) {
    let points = await this.getPoints(kvstore, key)
    points += amount
    await kvstore.set(`${key}:${this.id}`, points)
    return points
  }

  async countTotalChants(kvstore) {
    let sabotageRefs = await this.getPoints(kvstore, `cult:referrals:sabotage`)
    let selfRefs = await this.getPoints(kvstore, `cult:referrals:self`)
    console.log(this.name, "self-referrals:", selfRefs, "sabotage-refs:", sabotageRefs)
    let totalChants = await this.getPoints(kvstore, `cult`)
    var points = await this.getPoints(kvstore, `cult:creaturepoints`)
    var miscPoints = await this.getPoints(kvstore, `cult:miscsource`)
    let amplifiedPoints = await this.getPoints(kvstore, `cult:amplifiedPoints`)

    var fragments = await this.getPoints(kvstore, `cult:fragments`)
    var sabotageFragments = await this.getPoints(kvstore, `cult:fragments:sabotage`)
    var saboteurFragments = await this.getPoints(kvstore, `cult:fragments:saboteur`)
    var fragmentsPoints = fragments * FRAGMENTS_CULT_POINTS + sabotageFragments * FRAGMENTS_SABOTAGE_CULT_POINTS + saboteurFragments * FRAGMENTS_SABOTEUR_CULT_POINTS

    return totalChants + sabotageRefs * SABOTAGE_POINTS + selfRefs * RECRUIT_CULT_POINTS + this.bonusPoints + points + amplifiedPoints + miscPoints + fragmentsPoints
  }
  
  async getScore(server) {
    let totalChants = await this.countTotalChants(server.kvstore)
    let population = await server.kvstore.get(`cult:members:${this.id}`)
    if(population == 0) {
      return 0
    }
    return totalChants / Math.pow(population, 1.333)
  }
  
  async resetPoints(kvstore) {
    await kvstore.set(`cult:referrals:sabotage:${this.id}`, 0)
    await kvstore.set(`cult:referrals:self:${this.id}`, 0)
    await kvstore.set(`cult:${this.id}`, 0)
    await kvstore.set(`cult:creaturepoints:${this.id}`, 0)
    await kvstore.set(`cult:miscsource:${this.id}`, 0)
    await kvstore.set(`cult:amplifiedPoints:${this.id}`, 0)
    await kvstore.set(`cult:fragments:${this.id}`, 0)
    await kvstore.set(`cult:fragments:sabotage:${this.id}`, 0)
    await kvstore.set(`cult:fragments:saboteur:${this.id}`, 0)
    console.log("done resetting points for cult:", this.id)
  }

  async incrementCreaturePoints(kvstore, delta) {
    let points = await kvstore.get(`cult:creaturepoints:${this.id}`)
    if (points == null) {
      points = 0;
    }
    points += delta
    await kvstore.set(`cult:creaturepoints:${this.id}`, points)
  }

  async incrementBonusPoints(kvstore, delta) {
    await this.addPoints(kvstore, `cult:amplifiedPoints`, delta)
  }

  async getBonusPoints(kvstore) {
    return await this.getPoints(kvstore, `cult:amplifiedPoints`)
  }

  async rename(server, newName, newEmoji) {
    console.log("rename newName:", newName, "newEmoji:", newEmoji)
    let role = this.getRole(server)
    // Set channel name
    let channel = await this.channel(server)
    let oldName = role.name
    let newChannelName
    if (!newEmoji) {
      console.log("channel:", channel, "name:", oldName, "target:", oldName.toLowerCase().replaceAll(" ", "-"), "replacement:", newName.toLowerCase().replaceAll(" ", "-"))
      newChannelName = channel.name.replace(oldName.toLowerCase().replaceAll(" ", "-"), newName.toLowerCase().replaceAll(" ", "-"))
    } else {
      newChannelName = `${newEmoji}・${newName.toLowerCase().replaceAll(" ", "-")}`
      this.emoji = newEmoji
      await this.saveEmoji(server.kvstore)
    }
    console.log("new channel name:", newChannelName)
    try {
      await channel.setName(newChannelName)
    } catch (error) {
      console.log("setName error:", error)
      return false
    }

    // Set role name
    try {
      await role.edit({
        name: newName
      })
    } catch (error) {
      console.log(error)
      server.client.catch(error)
      return false
    }
  }
}

class Cults {
  constructor(cults) {
    this.cults = cults
  }

  async init(server, readOnly = false)  {
    for(let cult of this.values()) {
      await cult.init(server, readOnly)
    }
  }
  
  entries() {
    return Object.entries(this.cults)
  }

  values() {
    return Object.values(this.cults)
  }
  
  roles() {
    return this.values().map(cult => cult.roleId)
  }

  mergeStats(cultStats) {
    for (const stats of cultStats) {
      let cult = this.get(stats.id)
      cult.stats = stats
    }
  }

  get(id) {
    for (const [key, cult] of Object.entries(this.cults)) {
      if (id == cult.id) {
        return cult
      }
      if (Object.values(cult.channels).includes(id)) {
        return cult
      }
    }
    return null
  }

  roleCult(roleId) {
    for (const [key, cult] of Object.entries(this.cults)) {
      if (roleId == cult.roleId) {
        return cult
      }
    }
    return null
  }

  userCult(user) {
    for (const [key, _cult] of Object.entries(this.cults)) {
      if (user.roles.cache.has(_cult.roleId)) {
        return _cult
      }
    }
    return null
  }

  dbUserCult(user) {
    if (!user.cult_id || user.cult_id == "") {
      return null
    }
    for (const [key, _cult] of Object.entries(this.cults)) {
      if (user.cult_id == (_cult.id)) {
        return _cult
      }
    }
    return null
  }

  channelIds() {
    let out = []
    for (const [key, cult] of Object.entries(this.cults)) {
      out.push(cult.id)
    }
    return out
  }

  proposalChannelIds() {
    let out = []
    for (const [key, cult] of Object.entries(this.cults)) {
      out.push(cult.proposalsChannel)
    }
    return out
  }

  async countMembers(server) {
    let i = 0
    for (const _cult of this.values()) {
      i += await _cult.countMembers(server)
    }
    return i
  }
}

exports.Cult = Cult
exports.Cults = Cults