const { SlashCommandBuilder } = require('@discordjs/builders')
const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const clientId = '974842656372953118';

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN)

const equipCmd = new SlashCommandBuilder()
	.setName('equip')
	.setDescription('equip items')
const castCmd = new SlashCommandBuilder()
	.setName('cast')
	.setDescription('cast spells')
console.log("equip:", equipCmd.toJSON())

class Item {
  constructor(name, type, owner, acquiredAt, equipped){
    this.name = name
    this.owner = owner
    this.acquired_at = acquiredAt
    this.equipped = equipped
    this.type = type
  }
}

const SummoningShardName = "summoning shard"
const CelestialSummoningShardName = "celestial summoning shard"
const BanishingSpellName = "banishing eye"
const CorruptedBanishingSpellName = "corrupted banishing eye"
var ITEM_PARAMS = {
  "summoning shard": {
    name: SummoningShardName,
    limit: -1,
    type: "spell",
    emoji: {
      id: "982122017925005403",
      text: "<:shard:982122017925005403>"
    } 
  },
  "celestial summoning shard": {
    name: CelestialSummoningShardName,
    suffix: "",
    limit: 5,
    type: "spell",
    emoji: {
      id: "982122044617551882",
      text: "<:rare_shard:982122044617551882>"
    } 
  },
  "banishing eye": {
    name: BanishingSpellName,
    limit: -1,
    type: "spell",
    emoji: {
      id: "977338738189406258",
      text: "<:eyeofobservation:977338738189406258>"
    } 
  },
  "corrupted banishing eye": {
    name: CorruptedBanishingSpellName,
    limit: 5,
    type: "spell",
    emoji: {
      id: "983801506107105330",
      text: "<:corruptedeye:983801506107105330>"
    } 
  }
}

var castCache = {}
var cultAncients = {
  "972639993635938344": {name: "Nemoc", emoji: "🩸", statsChannel: "978446057853825024"}, //hex
  "973532685479854110": {name: "Fazurah the Child", emoji: "🧙", statsChannel: "978446924627718164"}, // wiz
  "973532570266533898": {name: "Shanar of Vyr", emoji: "🗡", statsChannel: "978446104163155998"} //pointless
}

async function init(server) {
  return
	try {
		console.log('Started refreshing application (/) commands.');
  
		await rest.put(
			Routes.applicationGuildCommands(clientId, server.Id),
			{ body: [equipCmd.toJSON(), castCmd.toJSON()] },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}

  for (var key in ITEM_PARAMS) {
    var params = ITEM_PARAMS[key]
    try {
      console.log("params:", params, "name:", params.name)
      await server.db.collection("counters").insert({
      	"id":params.name,
      	"sequence_value": 0
      })
    } catch(error) {
      console.log(error)
    }
  }
}

async function equipMask(server, member){
  // let mask = '🥽'
  // if(member.nickname != null && member.nickname.endsWith(mask)){
  //   return
  // }
  member.roles.add("975937160148553738")
  // try {
  //   await member.setNickname(`${member.nickname ? member.nickname : member.user.username} ${mask}`)
  // } catch(error) {
  //   console.log("set nickname error:", error)
  // }
}

async function getCultNumItemAssignments(server, cult, itemName) {
  let count = await server.db.collection("items").aggregate([
    {
      "$match": {
      "name": itemName,
      }
    },
    {
      "$lookup": {
          from: 'users',
          localField: 'owner',
          foreignField: 'discord.userid',
          as: 'owner'
      }
    },
    {
      "$match": {
      "owner.cult_id": cult.id,
      }
    },
    {
      $count: "num"
    }
  ])
  if(count){
    let c = await count.next()
    if(c){
      return c.num
    }
  }
  return 0
}

async function getCastCount(server, ancient, spell) {
  let count = await server.db.collection("casts").aggregate([
    {
      "$match": {
      "metadata.to.name": ancient.name,
      "metadata.item": spell
      }
    },
    {
      $count: "num"
    }
  ])
  if(count){
    let c = await count.next()
    if(c){
      return c.num
    }
  }
  return 0
}

async function assignItem(server, cult, itemName, memberId) {
  item = new Item(itemName, ITEM_PARAMS[itemName].type, memberId, new Date(), true)
  item.id = await server.getNextSequenceValue(itemName)

  var success = false
  try {
    // await server.db.collection("users").updateOne({"discord.userid": zealot.discord.userid},{$set:zealot}, {upsert:true})
    await server.db.collection("items").insert(item)
    success = true
  } catch (error) {
    console.error(error)
    success = false
  }
  if(success){
    let member = server.getMember(memberId)
    console.log("item.type:", item.type)
    if(item.type === "spell"){
      console.log("setting nickname")
      let name = member.nickname ? member.nickname : member.user.username
      if(name.includes('✨')){
        return success
      }
      try {
        let magicEmoji = '✨'
        await member.setNickname(`${name} ${magicEmoji}`)
      } catch(error) {
        console.log("set nickname error:", error)
      }
    }
  }
  return success
}

async function equipItem(server, itemName, member){
  console.log("equip item:", itemName)
  let cult = server.userIdCult(member.user.id)
  if(!cult){
    return "error: no cult found"
  }
  let count = await server.db.collection("items").count({name: itemName, owner: member.user.id})
  if(count>0){
    return "item already equipped"
  }
  let params = ITEM_PARAMS[itemName]
  if (params.limit >= 0){
    let used = await getCultNumItemAssignments(server, cult, itemName)
    let nremaining = params.limit - used
    if(nremaining < 1){
      return "no " + itemName + "s remaining"
    }
  }
  let success = await assignItem(server, cult, itemName, member.user.id)
  if(!success){
    return "item equipping failed.. ask hypervisor"
  }
  return itemName + " equipped!"
}

async function getOptions(server, member) {
  let cult = server.userIdCult(member.user.id)
  console.log("cult:", cult)
  if(!cult){
    return [{
      label: 'mask',
      emoji: { id: "975938373594251385"},
      value: 'mask',
    }]
  }
  let options = [
    {
      label: 'summoning shard',
      emoji: { id: "982122017925005403"},
      value: 'summoning shard',
    }
  ]
  let used = await getCultNumItemAssignments(server, cult, CelestialSummoningShardName)
  // console.log("used:", used)
  // console.log("ITEM_PARAMS:", ITEM_PARAMS, "CelestialSummoningShardName:", CelestialSummoningShardName)
  var params = ITEM_PARAMS[CelestialSummoningShardName]
  // console.log("params:", params)
  let nremaining = params.limit - used
  options.push({
    label: 'celestial summoning shard'+params.suffix,
    emoji: { id: "982122044617551882"},
    value: 'celestial summoning shard'+params.suffix,
    description: `x${nremaining}`
  })
  options.push({
    label: BanishingSpellName,
    emoji: { id: ITEM_PARAMS[BanishingSpellName].emoji.id},
    value: BanishingSpellName
  })
  used = await getCultNumItemAssignments(server, cult, CorruptedBanishingSpellName)
  params = ITEM_PARAMS[CorruptedBanishingSpellName]
  nremaining = params.limit - used
  options.push({
    label: CorruptedBanishingSpellName,
    emoji: { id: ITEM_PARAMS[CorruptedBanishingSpellName].emoji.id},
    value: CorruptedBanishingSpellName,
    description: `x${nremaining}`
  })
  options.push(
    {
      label: 'mask',
      emoji: { id: "975938373594251385"},
      value: 'mask',
    })
  return options
}

async function castSelectFrom(server, interaction) {
  if (interaction.values.length != 1){
    await interaction.update({ content: 'cannot select multiple values', components: [] })
    return
  }
  castCache[interaction.message.interaction.id] = interaction.values[0]
  let cult = server.userIdCult(interaction.member.user.id)
  let options = []
  for (const [id, ancient] of Object.entries(cultAncients)) {
    
    options.push({
      label: ancient.name,
      value: ancient.name,
      emoji: ancient.emoji
    })
  }

  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
        .setCustomId('cast_select_to')
        .setPlaceholder('ancient')
        .addOptions(options)
    );
  await interaction.update({ content: `${ITEM_PARAMS[interaction.values[0]].emoji.text} ${interaction.values[0]} selected! select target...`, components: [row], ephemeral:true })
}

function spellDelta(from) {
  let delta = 1
  switch(from){
    case CelestialSummoningShardName:
      // +3 to target
      delta = 3
      break
    case SummoningShardName:
      // +1 to target
      delta = 1
      break
    case BanishingSpellName:
      // -1 to target
      delta = -1
      break
    case CorruptedBanishingSpellName:
      delta = -3
      break
  }
  return delta
}

function spellDeltaStr(from) {
  let delta = spellDelta(from)
  if(delta >= 0){
    return `+${delta}`
  }
  return `${delta}`
}

var castToCache = {}

async function castSelectTo(server, interaction) {
  if (interaction.values.length != 1){
    await interaction.update({ content: 'cannot select multiple values', components: [] })
    return
  }
  
  castToCache[interaction.message.interaction.id] = interaction.values[0]
  let from = castCache[interaction.message.interaction.id] 
  console.log("from:", from)
  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('cast_confirm')
        .setLabel('Cast')
				.setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId('cast_cancel')
        .setLabel('Cancel')
				.setStyle('SECONDARY')
    );
  
  await interaction.update({ content: `cast ${ITEM_PARAMS[from].emoji.text} ${from} on ${castToCache[interaction.message.interaction.id]} (${spellDeltaStr(from)})`, components: [row], ephemeral:true })
}

async function castCancel(server, interaction) {
  delete castCache[interaction.message.interaction.id]
  delete castToCache[interaction.message.interaction.id]
  interaction.reply({content: 'cast canceled', ephemeral: true})
  return
}

async function castConfirm(server, interaction) {
  await interaction.deferReply({ephemeral:true})
  let target = castToCache[interaction.message.interaction.id]
  if(!target){
    console.log("no target found")
    interaction.editReply({content:'no spell target found, talk to hypervisor', ephemeral: true})
    return
  }
  for (const [id, ancient] of Object.entries(cultAncients)) {
    if(ancient.name == target){
      target = ancient
    }
  }
  
  var from = castCache[interaction.message.interaction.id]
  let user = await server.loadUser(interaction.member.user.id)
  
  let fromItem = await server.db.collection("items").findOne({
    owner: user.id,
    name: from
  })
  console.log("user:", user, "from:", from, "to:", target)
  if (user.lastSpellCast){
    let lastCheckpoint = (Date.now() - 4*60*60*1000) % (24 * 60 * 60 * 1000)
    if(Date.now() - lastCheckpoint > user.lastSpellCast) {
      // reset cast counts
      user.castCounts = {}
      user.lastSpellCast = Date.now()
    }
  } else {
    user.castCounts = {}
    user.lastSpellCast = Date.now()
  }
  let count = user.castCounts[from]
  if(!count) { count = 0 }
  if(count >= 2){
    // reply out of casts
    await interaction.editReply({ content: 'out of casts for spell', ephemeral: true, components: [] })
    return
  }
  user.castCounts[from] = count + 1
  // increment summons on target ancient
  let summons = await server.kvstore.get(`ancient:${target.name}`, {raw: false})
  if(summons == null){
    summons = 0
  }
  let delta = spellDelta(from)
  summons += delta
  console.log("user:", user)
  try {
    await server.db.collection("casts").insertOne({
      "metadata": { "user": user.id, "item": fromItem.name, "item_id": fromItem._id, "to": target },
      "timestamp": new Date(),
      "points": delta
    })
  } catch(error) {
    console.log(error)
    return
  }
  await server.saveUser(user)
  await server.kvstore.set(`ancient:${target.name}`, summons)
  summoningStats(server, target.name)
  logCast(server, user, from, target.name)
  try {
    interaction.editReply({content: 'your magic has been cast <:magic:975922950551244871>', ephemeral: true})
  } catch (error) {
    console.log("castConfirm interaction.reply error:", error)
  }
}

async function logCast(server, user, from, to) {
  let member = server.getMember(user.id)
  let msg = `${member} cast ${ITEM_PARAMS[from].emoji.text} ${from} on ${to} (${spellDeltaStr(from)})`
  let channel = await server.client.channels.cache.get("983467257143373824")
  channel.send(msg)
}

async function getRTStatsMsg(server){
  console.log("rt stats called")
  let sum = 0
  let max = 0
  let summonCounts = {}
  for (const [id, ancient] of Object.entries(cultAncients)) {
    let summons = await server.kvstore.get(`ancient:${ancient.name}`)
    if(summons == null){
      summons = 0
    }
    summonCounts[id] = summons
    sum += summons
    if(summons > max) {
      max = summons
    }
  }
  let msg = ""
  for (const [id, ancient] of Object.entries(cultAncients)) {
    var c = summonCounts[id]
    let b = await getCastCount(server, ancient, BanishingSpellName)
    let cb = await getCastCount(server, ancient, CorruptedBanishingSpellName)
    // let b = await server.db.collection("casts").count({"to.name": ancient.name, "item": BanishingSpellName})
    msg += `${ancient.emoji} ${ancient.name} <:shard:982122017925005403>${c+b+(cb*3)}  <:eyeofobservation:977338738189406258>${b}  ${ITEM_PARAMS[CorruptedBanishingSpellName].emoji.text}${cb}   •   ${c} ${c==max ? "✨":""}\n`
  }
  console.log("rt stats returning")
  return msg
}
async function updateRTStats(server){
  let _channelId = "983517113014689852"
  let beginMessageId = await server.kvstore.get(`summoning_stats:${_channelId}`)
  let channel = server.client.channels.cache.get(_channelId)
  if(beginMessageId){
    let msg = await channel.messages.fetch(beginMessageId)
    //msg.delete()
    if(msg) {
      msg.edit(await getRTStatsMsg(server))
      return
    }
  }
  let message = await channel.send(await getRTStatsMsg(server))
  await server.kvstore.set(`summoning_stats:${_channelId}`, message.id)
}

async function summoningStats(server, ancientName) {
  return
  console.log("summoning stats call")
  updateRTStats(server)
  let sum = 0
  let max = 0
  let summonCounts = {}
  for (const [id, ancient] of Object.entries(cultAncients)) {
    let summons = await server.kvstore.get(`ancient:${ancient.name}`, {raw: false})
    if(summons == null){
      summons = 0
    }
    summonCounts[id] = summons
    sum += summons
    if(summons > max) {
      max = summons
    }
  }
  for (const [id, ancient] of Object.entries(cultAncients)) {
    if(ancientName && ancientName != ancient.name){
      continue
    }
    var c = summonCounts[id]
    // let b = await server.db.collection("casts").count({"to": ancient.name, "item": BanishingSpellName})
    // let msg = `${ancient.emoji} ${ancient.name} <:shard:982122017925005403>${c+b} <:eyeofobservation:977338738189406258>${b} : ${c} ${c==max ? "✨":""}`
     // let msg = `${ancient.emoji} ${ancient.name} 🪄${c+b} 🧿${b} : ${c} ${c==max ? "✨":""}`
    let msg = `${ancient.emoji} ${ancient.name.split(" ")[0]} • ${c} ${c==max ? "✨":""}`
    let channel = await server.client.channels.cache.get(ancient.statsChannel)
    console.log("summoning msg:", msg, "channeL:", channel.id)
    try{
      await channel.setName(msg)
    } catch(error) {
      console.log("setName error:", error)
      return false
    }
  }
}

async function handleCast(server, interaction) {
  let items = await server.db.collection("items").find({
    owner: interaction.member.user.id,
    type: "spell"
  })
  // items = items.toArray()
  let user = await server.loadUser(interaction.member.user.id)
  console.log("user:", user)
  if (user.lastSpellCast){
    let lastCheckpoint = (Date.now() - 4*60*60*1000) % (24 * 60 * 60 * 1000)
    if(Date.now() - lastCheckpoint > user.lastSpellCast) {
      // reseemst cast counts
      user.castCounts = {}
    }
  } else {
    user.castCounts = {}
  }
  let options = await items.map(item => {
    let count = user.castCounts[item.name]
    if(!count) {
      count = 0
    }
    return {
      label: item.name,
      emoji: { id: ITEM_PARAMS[item.name].emoji.id},
      value: item.name,
      description: `${2-count}/2 casts remaining`
    }
  }).toArray()
  console.log("options:", options)
  if(options.length == 0){
    await interaction.reply({content: "no spells equipped, use /equip to add items to your inventory", ephemeral: true})
    return
  }
  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
        .setCustomId('cast_select_from')
        .setPlaceholder('inventory')
        .addOptions(options)
    );
  
  await interaction.reply({ content: 'select spell', components: [row], ephemeral:true })
}

async function handleInteraction(server, interaction) {
  // console.log(interaction)
  if (interaction.isSelectMenu()) {
    switch (interaction.customId) {
      case "select":
        if (interaction.values.length == 1){
          console.log("value:", interaction.values[0])
          switch(interaction.values[0]){
            case 'mask':
              await equipMask(server, interaction.member)
              await interaction.update({ content: '<:mask:975938373594251385>', components: [] })
              break
            case 'summoning shard':
              console.log("summoning shard equipping")
              var resp = await equipItem(server, interaction.values[0], interaction.member)
              await interaction.update({ content: resp, components: [] })
              break
            case 'celestial summoning shard':
              var resp = await equipItem(server, interaction.values[0], interaction.member)
              await interaction.update({ content: resp, components: [] })
              break
            case 'banishing eye':
              var resp = await equipItem(server, interaction.values[0], interaction.member)
              await interaction.update({ content: resp, components: [] })
              break
            case 'corrupted banishing eye':
              var resp = await equipItem(server, interaction.values[0], interaction.member)
              await interaction.update({ content: resp, components: [] })
              break
          }
          return
        }
        break
      case "cast_select_from":
        await castSelectFrom(server, interaction)
        break
      case "cast_select_to":
        await castSelectTo(server, interaction)
        break
    } 
  }
  
  if (interaction.isButton()) {
    switch (interaction.customId) {
      case "cast_confirm":
        await castConfirm(server, interaction)
        break
      case "cast_cancel":
        await castCancel(server, interaction)
        break
    }
  }
  if(interaction.isCommand()){
    switch(interaction.commandName){
      case 'equip':
        let options = await getOptions(server, interaction.member)
        console.log("options:", options)
        const row = new MessageActionRow()
    			.addComponents(
    				new MessageSelectMenu()
    					.setCustomId('select')
    					.setPlaceholder('select item')
              .addOptions(options)
    			);
    		await interaction.reply({ content: 'equip', components: [row], ephemeral:true })
        return
      case 'cast':
        await interaction.reply({ content: 'casting is strangely BLOCKED?',  ephemeral:true })
        return
        handleCast(server, interaction)
        return
    }
  }
}

exports.equip = {
  init: init,
  handleInteraction: handleInteraction,
  summoningStats: summoningStats
}