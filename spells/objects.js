const {
  TARGET_CULT_TYPE,
  CHEST_OBJECT
} = require('./constants')
const { MessageEmbed } = require('discord.js')
const { server } = require('../server.js')
const { gaussian, weightedRandomSelect, adjustRarities, RandGenerator, hashString } = require('../utils/rand')
const { message } = require('../client/message')
const { progress } = require('../utils/progress')
const { adventure } = require('./adventure')

class Chest {
  constructor(reward, numUnlocksReqd, summoner) {
    this.reward = reward
    this.numUnlocksReqd = numUnlocksReqd
    this.summoner = summoner
    this.lifespan = 6 * 60 * 60 * 1000
    this.created = new Date()
    this.end = new Date(this.created.getTime() + this.lifespan)
    this.type = CHEST_OBJECT
    this.state = "active"
    this.recipients = []
  }

  setTarget(target) {
    this.target = target
  }

  setId(id) {
    this.id = id
  }

  async update() {
    if (!this.messageId) {
      return
    }
    let channel = server.client.channels.cache.get(this.channelId)
    if (!channel) {
      console.log("no channel found:", this.channelId)
      return
    }
    let message = await channel.messages.fetch(this.messageId)
    if (!message) {
      return
    }
    let reaction = await message.reactions.resolve('🗝️')
    if(!reaction){
      return
    }
    // console.log("object reaction:", reaction)
    let members = await reaction.users.fetch()
    members = [...members.values()]
    console.log("object messageid:", this.messageId, "num reacts:", members.length, "num recipients:", this.recipients.length)
    for (var user of members) {
      if (this.recipients.includes(user.id) || user.id == this.summoner) {
        continue
      }
      this.recipients.push(user.id)
      if (this.recipients.length >= this.numUnlocksReqd) {
        break
      }
    }
    console.log("num recipients after update:", this.recipients.length)
    await server.db.collection("objects").update({ "id": this.id }, { $set: { recipients: this.recipients } })
    if (this.recipients.length >= this.numUnlocksReqd) {
      this.commit()
    } else {
      this.updateMsg()
    }
  }

  async addReaction(reaction, user) {
    console.log("object add reaction:", reaction.emoji, "is key:", reaction.emoji.name == "🗝️")
    //   if(reaction.emoji.name != "🗝"){
    //    return false
    //  }
    if (this.recipients.includes(user.id) || user.id == this.summoner) {
      console.log("recipients includes user:", user.id, "recipients:", this.recipients)
      return false
    }
    this.recipients.push(user.id)
    await server.db.collection("objects").update({ "id": this.id }, { $set: { recipients: this.recipients } })
    if (this.recipients.length >= this.numUnlocksReqd) {
      this.commit()
    } else {
      this.updateMsg()
    }
    return true
  }

  rewardEmoji() {
    return this.reward >= 0.8 ? "🥇" : this.reward >= 0.5 ? "🥈" : this.reward >= 0.1 ? "🥉" : "🪨"
  }

  async updateMsg() {
    let healthBar = progress(this.recipients.length, this.numUnlocksReqd, 10);
    var _cult = server.Cults.get(this.target.id)
    let updatedMsg = new MessageEmbed()
      .setTitle(`Locked Chest`)
      .setDescription(`get ${this.numUnlocksReqd} 🗝 reactions before <t:${Math.floor(this.end.getTime() / 1000)}:f> to unlock and get loot`)
      .addField('summoner', `${server.getMember(this.summoner)}`)
      // .addField('target', `<@&${server.Cults.get(this.target.id).roleId}>`)
      .addField('reward', `${this.rewardEmoji()}`)
      .addField('progress', `${healthBar} ${this.recipients.length}/${this.numUnlocksReqd}`)
      .addField('expires', `<t:${Math.floor(this.end.getTime() / 1000)}:f>`)
      .setColor('0x000000');
    let channel = server.client.channels.cache.get(this.channelId)
    if (!channel) {
      console.log("no channel found:", this.channelId)
      return
    }
    if (this.messageId) {
      let msg = await channel.messages.fetch(this.messageId)
      if (msg) {
        msg.edit({ embeds: [updatedMsg] })
        return
      }
    }
    let message = await channel.send({ embeds: [updatedMsg] })
    this.messageId = message.id
    await server.db.collection("objects").update({ "id": this.id }, { $set: { messageId: message.id } })
  }

  async issueReward() {
    const rewards = [
      // {value: "conjure_enemy", weight: 2},
      // {value: "conjure_ally", weight: 2},
      { value: "cult_points", weight: 5 },
      { value: "magic", weight: 50 },
    ]
    let _reward = weightedRandomSelect(Math.random(), adjustRarities(this.reward, rewards))
    switch (_reward.value) {
      case "magic":
        var amount = Math.max(5, Math.round( 1 * (this.reward * 15 + (Math.random() * this.reward * 10) + (Math.random() * 5))))
        var users = []
        this.recipients.push(this.summoner)
        for (const id of this.recipients) {
          let member = server.getMember(id)
          if (member) {
            users.push(member)
            try {
              await server.db.collection("users").updateOne({ "discord.userid": member.id }, {
                $inc: { coins: amount }
              })
            } catch (err) {
              console.log("add coins error:", err)
            }
          }
        }
        return `${amount} magic <:magic:975922950551244871> to each zealot & summoner ${server.getMember(this.summoner)}`
      case "cult_points":
        var amount = Math.max(2, Math.round(0.6 * (this.reward * 12 + (Math.random() * this.reward * 6) + (Math.random() * 2))))
        let cult = server.Cults.get(this.target.id)
        await cult.addPoints(server.kvstore, 'cult:miscsource', amount)
        return `${amount} points 𐂥 to ${server.Cults.get(this.target.id).getName(server)}!`
    }
    return null
  }

  async commit() {
    let rewardMsg = await this.issueReward()
    let recipientsLen = this.recipients.length - 1
    let healthBar = progress(recipientsLen, this.numUnlocksReqd, 10)
    let recipientsMsg = ""
    for (const id of this.recipients) {
      recipientsMsg += `${server.getMember(id)}`
    }
    let updatedMsg = new MessageEmbed()
      .setTitle(`Locked Chest - UNLOCKED!`)
      .setDescription(`chest unlocked!`)
        .addField('zealots', recipientsMsg)
        .addField('summoner', `${server.getMember(this.summoner)}`)
        .addField('reward', rewardMsg)
        .addField('progress', `${healthBar} ${recipientsLen}/${this.numUnlocksReqd}`)
        // .addField('expires', `<t:${this.end.getTime() / 1000}:f>`)
        .setColor('0x000000');
    let channel = server.client.channels.cache.get(this.channelId)
    if (!channel) {
      console.log("no channel found:", this.channelId)
      return
    }
    if (this.messageId) {
      let msg = await channel.messages.fetch(this.messageId)
      if (msg) {
        msg.edit({ embeds: [updatedMsg] })
        await server.db.collection("objects").update({ "id": this.id }, { $set: { state: "used" } })
        return
      }
    }
    let message = await channel.send({ embeds: [updatedMsg] })
    this.messageId = message.id
    this.state = "used"
    await server.db.collection("objects").update({ "id": this.id }, { $set: { messageId: message.id, state: this.state } })
    adventure.log(server, "Chest Unlocked! " + rewardMsg)
  }
}

async function createChest(power, targetCult, creatorId) {
  let numUnlocksReqd = Math.max(4, Math.round(0.75 * (power * 10 + (Math.random() * power * 3) + (Math.random() * 2))))
  let chest = new Chest(power, numUnlocksReqd, creatorId)
  console.log("getting next objects seq value...")
  chest.id = await server.getNextSequenceValue("objects")
  console.log("got next objects seq value")
  chest.setTarget({ type: TARGET_CULT_TYPE, id: targetCult.id })
  chest.channelId = targetCult.id
  await server.db.collection("objects").insertOne(chest)
  await chest.updateMsg(server)
  return chest
}

async function init() {
  if (! await server.getSequenceValue("objects")) {
    try {
      await server.db.collection("counters").insert({
        "id": "objects",
        "sequence_value": 0
      })
    } catch (error) {
      console.log(error)
    }
  }
}

function setPrototype(object) {
  switch (object.type) {
    case CHEST_OBJECT:
      Object.setPrototypeOf(object, Chest.prototype)
      break
  }
}

async function run() {
  var _runKill = async () => {
    let now = new Date()
    let objects = await server.db.collection("objects").find({ end: { $lte: now } })
    if (!objects) {
      return
    }
    objects = await objects.toArray()
    objects.map(async (object) => {
      if (object.end <= now) {
        console.log("removing dead object:", object)
        if (object.state != 'used') {
          let channel = server.client.channels.cache.get(object.channelId)
          try {
            await channel.messages.delete(object.messageId)
          } catch (err) {
            console.log("err:", err)
          }
        }
        await server.db.collection("objects").remove({ id: object.id })
      }
    })
  }
  var _runUpdate = async () => {
    let now = new Date()
    let objects = await server.db.collection("objects").find({ state: "active" })
    if (!objects) {
      return
    }
    objects = await objects.toArray()
    objects.map(async (object) => {
      if (object.end > now && object.state == "active") {
        setPrototype(object)
        await object.update()
      }
    })
  }
  setInterval(() => {
    _runKill()
  }, 15000)
  setInterval(() => {
    _runUpdate()
  }, 67000)
  _runUpdate()
}

async function msgIsObject(msgId) {
  let n = await server.db.collection("objects").count({ messageId: msgId })
  return n > 0
}

async function addReaction(reaction, user) {
  if (user.bot) {
    return false
  }
  console.log("object add reaction:", reaction.emoji)
  if (["🗝"].includes(reaction.emoji.name)){
    console.log("includes key!")
  }
  if ("🗝" == reaction.emoji.name){
    console.log("== key!")
  }
  // if (!["🗝"].includes(reaction.emoji.name)){
  //   return false
  // }
  // TODO: cache object message ids
  let object = await server.db.collection("objects").findOne({ messageId: reaction.message.id, state: "active" })
  if (!object) {
    console.log("no object found")
    return false
  }
  setPrototype(object)
  // switch (object.type) {
  //   case CHEST_OBJECT:
  //     Object.setPrototypeOf(object, Chest.prototype)
  //     break
  // }
  try {
    let success = await object.addReaction(reaction, user)
    return success
  } catch (err) {
    console.log("add reaction error:", err)
  }
  return false
}

exports.objects = {
  init: init,
  run: run,
  createChest: createChest,
  msgIsObject: msgIsObject,
  addReaction: addReaction
}