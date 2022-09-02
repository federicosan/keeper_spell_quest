const { progress } = require('../utils/progress')
const { SetChannelPermissions, CULTIST_READ_ONLY, CULTIST_READ_WRITE } = require('../utils/permissions')
const { MessageEmbed, Permissions } = require('discord.js');
const { updateAllStats } = require('../game/stats.js')
const { ENEMY_TYPE, ALLY_TYPE, FREEZE_TYPE, TARGET_CULT_TYPE, TARGET_PLAYER_TYPE } = require('./constants.js')
const { adventure } = require('./adventure')


const nonAncientLikelihood = 0.95
const LIFESPAN = 2 * 24 * 60 * 60 * 1000

class Creature {
  constructor(strength, health, name, type) {
    this.strength = strength
    this.healthRemaining = health
    this.health = health
    this.name = name
    this.created = new Date()
    this.attackPeriod = 4 * 60 * 60 * 1000
    this.lastAttack = 0
    this.type = type
  }

  setTarget(target) {
    this.target = target
  }

  setId(id) {
    this.id = id
  }

  setStatusMsg(channelId, messageId) {
    this.channelId = channelId
    this.messageId = messageId
  }

  async getSummoner(server) {
    let cast = await server.db.collection("events").findOne({ event: 'cast', 'metadata.creature': this.id })
    if (cast) {
      let member = server.getMember(cast.metadata.user)
      if (!member) {
        return '___'
      }
      let cult = server.Cults.userCult(member)
      return `${cult.emoji}${member}`
    }
    return '___'
  }

  async updateMsg(server) {
    if (this.type == FREEZE_TYPE) {
      await this.freezerUpdateMsg(server)
      return
    }
    let healthBar = progress(this.healthRemaining, this.health, 10);
    console.log("here, creature:", this)
    var _cult = server.Cults.get(this.target.id)
    let updatedMsg = new MessageEmbed()
      .setTitle(`${this.name}`)
      .setDescription(`${this.name} is ${this.type == ALLY_TYPE ? "helping" : "attacking"} ${_cult.getName(server)}!`)
      // .addField('target', `<@&${server.Cults.get(this.target.id).roleId}>`)
      .addField('target', `${server.Cults.get(this.target.id).getName(server)}`)
      .addField('summoner', await this.getSummoner(server))
      .addField('power', `${this.type == ALLY_TYPE ? '+' : '-'}${this.strength}𐂥`)
      .addField('attack-period', `${this.attackPeriod / (60 * 1000)} minutes`)
      .addField('hp', `${healthBar} ${this.healthRemaining}/${this.health}`)
      .setColor('0x000000');
    console.log("msg:", updatedMsg)
    let channel = server.client.channels.cache.get(this.channelId)
    if (!channel) {
      console.log("no channel found:", this.channelId)
      return
    }
    if (this.messageId) {
      let msg = await channel.messages.fetch(this.messageId)
      if (msg) {
        try {
          await msg.edit({ embeds: [updatedMsg] })
        } catch(err){
          console.log("error editing msg:", err)
        }
        return
      }
    }
    let message = await channel.send({ embeds: [updatedMsg] })
    this.messageId = message.id
    await server.db.collection("creatures").update({ "id": this.id }, { $set: { messageId: message.id } })
  }

  async freezerUpdateMsg(server) {
    let healthBar = progress(this.healthRemaining, this.health, 10);
    console.log("here, creature:", this)
    let member = server.getMember(this.target.id)
    var _cult
    if(member){
      _cult = server.Cults.userCult(member)
    }
    let updatedMsg = new MessageEmbed()
      .setTitle(`${this.name}`)
      .setDescription(`${this.name} has abducted ${member} of ${_cult.getName(server)}!`)
      .addField('target', `${member}`)
      .addField('summoner', await this.getSummoner(server))
      .addField('hp', `${healthBar} ${this.healthRemaining}/${this.health}`)
      .setColor('0x000000');
    console.log("msg:", updatedMsg)
    let channel = server.client.channels.cache.get(this.channelId)
    if (!channel) {
      console.log("no channel found:", this.channelId)
      return
    }
    if (this.messageId) {
      let msg = await channel.messages.fetch(this.messageId)
      if (msg) {
        try {
          await msg.edit({ embeds: [updatedMsg] })
        } catch(err){
          console.log("error editing msg:", err)
        }
        return
      }
    }
    let message = await channel.send({ embeds: [updatedMsg] })
    this.messageId = message.id
    await server.db.collection("creatures").update({ "id": this.id }, { $set: { messageId: message.id } })
  }

  async handleDefeat(server) {
    if (this.type == FREEZE_TYPE) {
      let member = server.getMember(this.target.id)
      if (member) {
        member.roles.remove(server.Roles.Abducted)
      }
    }
  }
}

class CreatureGenerator {
  constructor(names, ancients, prefixes, suffixes) {
    this.names = names
    this.ancients = ancients
    this.prefixes = prefixes
    this.suffixes = suffixes
  }

  _getName(power) {
    var name = ""

    if (power >= nonAncientLikelihood) {
      return this.ancients[Math.floor(Math.random() * this.ancients.length) % this.ancients.length]
    }


    let gp = power * 21
    let greatness = Math.floor(gp) % 21
    let namePower = power
    name = this.names[Math.floor(Math.random() * this.names.length) % this.names.length]

    if (greatness >= 19) {
      name = this.names[Math.floor((gp - 19) / (21 - 19) * this.names.length) % this.names.length]
      return this.prefixes[Math.floor(Math.random() * this.prefixes.length) % this.prefixes.length] + " " + name + " " + this.suffixes[Math.floor(Math.random() * this.suffixes.length) % this.suffixes.length]
    }
    if (greatness >= 16) {
      name = this.names[Math.floor((gp - 16) / (19 - 16) * this.names.length) % this.names.length]
      return name + " " + this.suffixes[Math.floor(Math.random() * this.suffixes.length) % this.suffixes.length]
    }
    if (greatness >= 13) {
      name = this.names[Math.floor((gp - 13) / (16 - 13) * this.names.length) % this.names.length]
      return this.prefixes[Math.floor(Math.random() * this.prefixes.length) % this.prefixes.length] + " " + name
    }
    return this.names[Math.floor((gp) / (13) * this.names.length) % this.names.length]
  }

  generate(power, type) {
    const healthAmp = 2.5
    const strengthAmp = 1.5
    var name = this._getName(power)
    // var strength = Math.max(1, Math.round( 0.75 * (power * 25 + (Math.random() * power * 5) + (Math.random() * 2))))
    var strength = Math.max(1, Math.round(0.5 * (power * 20 + (Math.random() * power * 3) + (Math.random() * 2))))

    //var health = Math.max(5, Math.round(power * 50 + (Math.random() * power*10) + Math.random() * 3))
    // var health = Math.max(5, Math.round(0.65 * (Math.round(power * 50 + (Math.random() * power*10) + Math.random() * 10))))
    var health = Math.max(5, Math.round(0.65 * (Math.round(power * 35 + (Math.random() * power * 6) + Math.random() * 6))))
    if (Math.floor(power * 21) >= 13) {
      strength += 2;
      health += 4;
    }
    if (power >= nonAncientLikelihood) {
      strength += (power/nonAncientLikelihood) * 4 + 4;
      health += (power/nonAncientLikelihood) * 10 + 4;
    }
    strength = Math.round(Math.max(1, Math.round(strength / 3)) * strengthAmp)
    health = Math.round(health * healthAmp)
    return new Creature(strength, health, name, type)
  }
}

var monsterGenerator = new CreatureGenerator(
  [
    "Squirrel",
    "Spider",
    "Imp",
    "Troll",
    "Worm",
    "Dragon",
    "Rabbit"
  ],
  [
    "Sarlon the Lost",
    "Iluvatar",
    "Golrag",
    "Ishnak",
    "Rrazul",
    "Melkor",
    "Skoll"
  ],
  [
    "Giant",
    "Befouled",
    "Burned",
    "Dark",
    "Demonic",
    "Corrupted"
  ],
  [
    "of Death",
    "of the Undead",
    "of Oblivion",
    "of the Outer Realm",
    "of Vyr"
  ]
)

var allyGenerator = new CreatureGenerator(
  [
    "Water",
    "Artifact",
    "Peasant",
    "Mystic",
    "Elf"
  ],
  [
    "Morvian the Bold",
    "Alatar",
    "Si'mar",
    "Vehari",
    "Masiara",
    "Lorien",
    "Vana"
  ],
  [
    "Ancient",
    "Blessed",
    "Hidden",
    "Faerie",
    "Dwarven",
    "Druid",
    "Celestial"
  ],
  [
    "of Vitality",
    "of Hope",
    "of Power",
    "of Ascension",
    "of Time"
  ]
)

var freezerGenerator = new CreatureGenerator(
  [
    "Chains"
  ],
  [
    "Sarlon the Lost",
    "Iluvatar",
    "Golrag",
    "Ishnak",
    "Rrazul",
    "Melkor",
    "Skoll"
  ],
  [
    "Giant",
    "Befouled",
    "Burned",
    "Dark",
    "Demonic",
    "Corrupted"
  ],
  [
    "of Death",
    "of the Undead",
    "of Oblivion",
    "of the Outer Realm",
    "of Vyr"
  ]
)

// new collections:
// creatures
// itemTypes
//   item-params from before

// new fields
// user.numRecruits  
// user.num_chants
// user.dust: current dust balance (generated by earning points)
// user.points: total points earned
async function logChainsBroken(server, creature) {
  try {
    await server.db.collection("events").insertOne({
      "metadata": { "user": creature.target.id, "creature": creature.id },
      "timestamp": new Date(),
      "event": "chains_broken"
    })
  } catch (error) {
    console.log("handleRecruitment error:", error)
    return
  }
}

async function handleDamage(server, creatureId, damage) {
  let creature = await server.db.collection("creatures").findOne({ id: creatureId })
  console.log("handleDamage creatureId:", creatureId, "creature:", creature, "damage:", damage)
  Object.setPrototypeOf(creature, Creature.prototype)
  creature.healthRemaining -= damage
  if (creature.healthRemaining <= 0) {
    creature.healthRemaining = 0
    await creature.handleDefeat(server)
    let channel = server.client.channels.cache.get(creature.channelId)
    setTimeout(() => {
      try {
        channel.delete()
      } catch (error) {
        console.log("handleDamage channel delete error:", error) 
      }
    }, 30 * 1000)
    await server.db.collection("creatures").update({ id: creatureId }, { $set: { healthRemaining: 0 } })
    // await server.db.collection("creatures").remove({id: creatureId})
  } else {
    await server.db.collection("creatures").update({ id: creatureId }, { $set: { healthRemaining: creature.healthRemaining } })
  }
  await creature.updateMsg(server)
  if (creature.healthRemaining <= 0) {
    if (creature.type == FREEZE_TYPE) {
      adventure.log(server, `<@${creature.target.id}> ${creature.name} broken!`)
      try {
        await logChainsBroken(server, creature)
      } catch (err) {
        console.log("log chains broken error:", err)
      }
    } else {
      // <@&${server.Cults.get(creature.target.id).roleId}> 
      adventure.log(server, `${creature.name} defeated!`)
    }
  }
  // TODO:
  // if killed:
  // announce death, drop loot
  return creature
}

// death of natural causes
async function killCreature(server, creature) {
  Object.setPrototypeOf(creature, Creature.prototype)
  creature.healthRemaining = 0
  await creature.handleDefeat(server)
  let channel = server.client.channels.cache.get(creature.channelId)
  setTimeout(() => {
    try {
      channel.delete()
    } catch (error) {
      console.log("killCreature channel delete error:", error) 
    }
  }, 60 * 1000)
  await server.db.collection("creatures").update({ id: creature.id }, { $set: { healthRemaining: 0 } })
  await creature.updateMsg(server)
  if (creature.healthRemaining <= 0) {
    if (creature.type == FREEZE_TYPE) {
      adventure.log(server, `<@${creature.target.id}> ${creature.name} wore out with time...`)
      try {
        await logChainsBroken(server, creature)
      } catch (err) {
        console.log("log chains broken error:", err)
      }
    } else {
      // <@&${server.Cults.get(creature.target.id).roleId}>
      adventure.log(server, `${creature.name} died of natural causes ⚰️`)
    }
  }
  return creature
}

async function _conjureMonster(server, power, targetCultId) {
  let creature = monsterGenerator.generate(power, ENEMY_TYPE)
  creature.id = await server.getNextSequenceValue("creatures")
  creature.setTarget({ type: TARGET_CULT_TYPE, id: targetCultId })

  let targetCult = server.Cults.get(targetCultId)
  var guild = server.client.guilds.cache.get(server.Id)
  console.log("creating channel...")
  let channel = await guild.channels.create(`⚔️${targetCult.emoji}${creature.name}`, {
    type: "text",
    parentId: targetCult.channels.DungeonSectionId,
    // prevent everyone from viewing, then set who can view
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [
          Permissions.FLAGS.VIEW_CHANNEL,
          Permissions.FLAGS.CREATE_PUBLIC_THREADS,
          Permissions.FLAGS.CREATE_PRIVATE_THREADS,
          Permissions.FLAGS.ATTACH_FILES,
          Permissions.FLAGS.EMBED_LINKS,
        ],
      }
    ]
  })
  await channel.setParent(targetCult.channels.DungeonSectionId)
  console.log("channel created!")
  await SetChannelPermissions(server, channel, CULTIST_READ_WRITE)
  creature.channelId = channel.id
  await server.db.collection("creatures").insertOne(creature)
  await creature.updateMsg(server)
  setTimeout(async () => {
    creature.updateMsg(server)
  }, 30 * 1000)
  return creature
}

async function _conjureAlly(server, power, targetCultId) {
  let creature = allyGenerator.generate(power, ALLY_TYPE)
  creature.id = await server.getNextSequenceValue("creatures")
  creature.setTarget({ type: TARGET_CULT_TYPE, id: targetCultId })

  let targetCult = server.Cults.get(targetCultId)
  var guild = server.client.guilds.cache.get(server.Id)
  let channel = await guild.channels.create(`🌱${targetCult.emoji}${creature.name}`, {
    type: "text",
    parentId: targetCult.channels.DungeonSectionId,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [Permissions.FLAGS.VIEW_CHANNEL],
      }
    ]
  })
  await channel.setParent(targetCult.channels.DungeonSectionId)
  await SetChannelPermissions(server, channel, CULTIST_READ_WRITE)
  creature.channelId = channel.id
  server.db.collection("creatures").insertOne(creature)
  creature.updateMsg(server)
  setTimeout(async () => {
    creature.updateMsg(server)
  }, 30 * 1000)
  return creature
}

async function _conjureFreezer(server, power, targetUserId) {
  let creature = freezerGenerator.generate(power, FREEZE_TYPE)
  creature.id = await server.getNextSequenceValue("creatures")
  creature.setTarget({ type: TARGET_PLAYER_TYPE, id: targetUserId })
  let member = server.getMember(targetUserId)
  if(!member){
    return null
  }
  let targetCult = server.Cults.userCult(member)
  var guild = server.client.guilds.cache.get(server.Id)
  console.log("creating channel...")
  let channel = await guild.channels.create(`⛓${targetCult.emoji}${member.displayName}`, {
    type: "text",
    parentId: targetCult.channels.DungeonSectionId,
    // prevent everyone from viewing, then set who can view
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [
          Permissions.FLAGS.VIEW_CHANNEL,
          Permissions.FLAGS.CREATE_PUBLIC_THREADS,
          Permissions.FLAGS.CREATE_PRIVATE_THREADS,
          Permissions.FLAGS.ATTACH_FILES,
          Permissions.FLAGS.EMBED_LINKS,
        ],
      }
    ]
  })
  await channel.setParent(targetCult.channels.DungeonSectionId)
  console.log("channel created!")
  await SetChannelPermissions(server, channel, CULTIST_READ_WRITE)
  creature.channelId = channel.id
  await server.db.collection("creatures").insertOne(creature)
  await creature.updateMsg(server)
  try {
    console.log("adding role:", server.Roles.Abducted)
    await member.roles.add(server.Roles.Abducted)
  } catch (err) {
    console.log("error:", err)
  }
  setTimeout(async () => {
    creature.updateMsg(server)
  }, 30 * 1000)
  return creature
}

async function runCreatures(server) {
  //console.log("running creatures")
  let creatures = await server.db.collection("creatures").find({
    healthRemaining: { $gt: 0 }
  })
  creatures = await creatures.toArray()
  //console.log("creatures:", creatures)
  if (!creatures) {
    return
  }
  creatures.map(async (creature) => {
    let _now = Date.now()
    if (_now >= new Date(creature.created.getTime() + LIFESPAN)) {
      killCreature(server, creature)
      return
    }
    //await handleDamage(server, creature.id, 0)
    let expected = _now - creature.attackPeriod
    // console.log("expected:", expected, "now:", _now)
    if (expected <= creature.lastAttack) {
      return
    }
    // deal damage
    creature.lastAttack = _now
    let cult = server.Cults.get(creature.target.id)
    if (creature.type == ENEMY_TYPE) {
      console.log("dealing creature damage")
      await cult.incrementCreaturePoints(server.kvstore, -creature.strength)
      try {
        //adventure.log(server, `${creature.name} dealt -${creature.strength} to <@&${cult.roleId}>`)
        adventure.log(server, `${creature.name} dealt -${creature.strength} to ${cult.getName(server)}`)
      } catch (err) {
        console.log("log damage err:", err)
      }
    } else if (creature.type == ALLY_TYPE) {
      console.log("dealing ally support")
      await cult.incrementCreaturePoints(server.kvstore, creature.strength)
      try {
        adventure.log(server, `${creature.name} added +${creature.strength} cult points to ${cult.getName(server)}`)
      } catch (err) {
        console.log("log healing err:", err)
      }
    }
    await server.db.collection("creatures").update({ id: creature.id }, { $set: { lastAttack: _now } })
    updateAllStats(cult)
  })
}

async function init(server) {
  // try {
  //   await server.db.collection("counters").insert({
  //     "id":"creatures",
  //     "sequence_value": 0
  //   })
  // } catch(error) {
  //   console.log(error)
  // }
  // try {
  //   await server.db.collection("counters").insert({
  //     "id":"items",
  //     "sequence_value": 0
  //   })
  // } catch(error) {
  //   console.log(error)
  // }
}

async function run(server) {
  setInterval(() => {
    runCreatures(server)
  }, 10000)
}

exports.Creature = Creature
exports.creatures = {
  init: init,
  run: run,
  conjureEnemy: _conjureMonster,
  conjureAlly: _conjureAlly,
  conjureFreezer: _conjureFreezer,
  handleDamage: handleDamage,
  killCreature: killCreature
}

async function testGenerateEnemy(power) {
  return monsterGenerator.generate(power, ENEMY_TYPE)
}

async function testGenerateAlly(power) {
  return allyGenerator.generate(power, ALLY_TYPE)
}

exports.testCreatures = {
  generateEnemy: testGenerateEnemy,
  generateAlly: testGenerateAlly
}