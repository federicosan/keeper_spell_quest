const {
  SABOTAGE_POINTS,
  RECRUIT_CULT_POINTS,
  FRAGMENTS_CULT_POINTS,
  FRAGMENTS_SABOTAGE_CULT_POINTS,
  FRAGMENTS_SABOTEUR_CULT_POINTS
} = require('../spells/constants.js')

class Cult {
  constructor(name, id, chant, emoji, discordEmoji, roleId, statsChannel, proposalsChannel, emojiId, bonusPoints) {
    this.name = name
    this.id = id
    this.chant = chant
    this.emoji = emoji
    this.discordEmoji = discordEmoji
    this.roleId = roleId
    this.statsChannel = statsChannel
    this.proposalsChannel = proposalsChannel
    this.emojiId = emojiId
    this.bonusPoints = bonusPoints
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
    return server.client.channels.cache.get(this.id)
  }

  getRole(server) {
    let guild = server.client.guilds.cache.get(server.Id);
    return guild.roles.cache.get(this.roleId)
  }

  async countMembers(server) {
    let role = this.getRole(server)
    return role.members.size
  }

  async saveEmoji(database) {
    await database.set(`cult:emoji:${this.id}`, this.emoji)
  }

  async getPoints(database, key) {
    var points = await database.get(`${key}:${this.id}`, { raw: false })
    if (points == null) {
      points = 0;
    }
    return points
  }

  async addPoints(database, key, amount) {
    let points = await this.getPoints(database, key)
    points += amount
    await database.set(`${key}:${this.id}`, points)
    return points
  }

  async countTotalChants(database) {
    let sabotageRefs = await this.getPoints(database, `cult:referrals:sabotage`)
    let selfRefs = await this.getPoints(database, `cult:referrals:self`)
    console.log(this.name, "self-referrals:", selfRefs, "sabotage-refs:", sabotageRefs)
    let totalChants = await this.getPoints(database, `cult`)
    var points = await this.getPoints(database, `cult:creaturepoints`)
    var miscPoints = await this.getPoints(database, `cult:miscsource`)
    let amplifiedPoints = await this.getPoints(database, `cult:amplifiedPoints`)

    var fragments = await this.getPoints(database, `cult:fragments`)
    var sabotageFragments = await this.getPoints(database, `cult:fragments:sabotage`)
    var saboteurFragments = await this.getPoints(database, `cult:fragments:saboteur`)
    var fragmentsPoints = fragments * FRAGMENTS_CULT_POINTS + sabotageFragments * FRAGMENTS_SABOTAGE_CULT_POINTS + saboteurFragments * FRAGMENTS_SABOTEUR_CULT_POINTS

    return totalChants + sabotageRefs * SABOTAGE_POINTS + selfRefs * RECRUIT_CULT_POINTS + this.bonusPoints + points + amplifiedPoints + miscPoints + fragmentsPoints
  }

  async resetPoints(database) {
    await database.set(`cult:referrals:sabotage:${this.id}`, 0)
    await database.set(`cult:referrals:self:${this.id}`, 0)
    await database.set(`cult:${this.id}`, 0)
    await database.set(`cult:creaturepoints:${this.id}`, 0)
    await database.set(`cult:miscsource:${this.id}`, 0)
    await database.set(`cult:amplifiedPoints:${this.id}`, 0)
    await database.set(`cult:fragments:${this.id}`, 0)
    await database.set(`cult:fragments:sabotage:${this.id}`, 0)
    await database.set(`cult:fragments:saboteur:${this.id}`, 0)
    console.log("done resetting points for cult:", this.id)
  }

  async incrementCreaturePoints(database, delta) {
    let points = await database.get(`cult:creaturepoints:${this.id}`, { raw: false })
    if (points == null) {
      points = 0;
    }
    points += delta
    await database.set(`cult:creaturepoints:${this.id}`, points)
  }

  async incrementBonusPoints(database, delta) {
    await this.addPoints(database, `cult:amplifiedPoints`, delta)
  }

  async getBonusPoints(database) {
    return await this.getPoints(database, `cult:amplifiedPoints`)
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
      await this.saveEmoji(server.database)
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

  entries() {
    return Object.entries(this.cults)
  }

  values() {
    return Object.values(this.cults)
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
      if (id == cult.proposalsChannel) {
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

  async loadEmojis(database) {
    for (const [key, cult] of Object.entries(this.cults)) {
      let emoji = await database.get(`cult:emoji:${cult.id}`, { raw: false })
      if (emoji) {
        console.log("CULT EMOJI:", emoji)
        cult.emoji = emoji
        cult.discordEmoji = emoji
      }
    }
  }
}

exports.Cult = Cult
exports.Cults = Cults