const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')
const { spells } = require('./spells')
const {
  CONJURE_ENEMY_SPELL,
  CONJURE_ALLY_SPELL,
  CONJURE_FREEZE_SPELL,
  ATTACK_SPELL,
  MAGIC_BOOST_SPELL,
  CULT_POINT_BOOST_SPELL,
  CHEST_SPELL,
  BEES_SPELL
} = require('./constants.js')

const { bees } = require('./types/bees')
const { chest } = require('./types/chest')
const { summon } = require('./types/summon')
const { cp_boost } = require('./types/cp_boost')
const { magic_boost } = require('./types/magic_boost')
const { attack } = require('./types/attack')
const { store } = require('./store')

var castCache = {}
var castToCache = {}

async function cancel(server, interaction) {
  delete castCache[interaction.message.interaction.id]
  delete castToCache[interaction.message.interaction.id]
  interaction.update({ content: 'cast canceled', components: [], ephemeral: true })
}

async function start(server, interaction) {
  // map spell-type to flow / effect
  // get spells, display as list
  let items = await server.db.collection("items").find({
    owner: interaction.member.id
  })
  console.log("items:", items)
  let options = await items.map(item => {
    return {
      value: item.id,
      // emoji: { id: ITEM_PARAMS[item.name].emoji.id},
      label: item.name,
      description: spells.SpellDescriptions[item.type]
    }
  }).toArray()
  console.log("options:", options)
  if (options.length == 0) {
    await interaction.reply({ content: "no spells in your inventory, use /conjure to create spells", ephemeral: true })
    return
  }
  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
        .setCustomId('cast_select_from')
        .setPlaceholder('inventory')
        .addOptions(options)
    );
  await interaction.reply({ content: 'select spell', components: [row], ephemeral: true })
}

async function selectFrom(server, interaction) {
  if (interaction.values.length != 1) {
    await interaction.update({ content: 'cannot select multiple values', components: [], ephemeral: true })
    return
  }
  var item;
  try {
    item = await server.db.collection("items").findOne({
      id: interaction.values[0]
    })
  } catch (error) {
    console.log("error:", error)
    await interaction.update({ content: `error: ${error} | talk to @hypervisor`, components: [], ephemeral: true })
    return
  }
  switch (item.type) {
    case ATTACK_SPELL:
      // pick target creature (in the future, include binding field or whatever)
      var spell = new attack.spellType(item)
      await spell.handleSelectFrom(server, interaction, castCache)
      return
    case CONJURE_ALLY_SPELL:
      var spell = new summon.spellType(item)
      await spell.handleSelectFrom(server, interaction, castCache)
      return
    case CONJURE_ENEMY_SPELL:
      var spell = new summon.spellType(item)
      await spell.handleSelectFrom(server, interaction, castCache)
      return
    case CONJURE_FREEZE_SPELL:
      var spell = new summon.spellType(item)
      await spell.handleSelectFrom(server, interaction, castCache)
      return
    case CULT_POINT_BOOST_SPELL:
      var spell = new cp_boost.spellType(item)
      await spell.handleSelectFrom(server, interaction, castCache)
      return
    case MAGIC_BOOST_SPELL:
      var spell = new magic_boost.spellType(item)
      await spell.handleSelectFrom(server, interaction, castCache)
      return
    case CHEST_SPELL:
      var spell = new chest.spellType(item)
      await spell.handleSelectFrom(server, interaction, castCache)
      return
    case BEES_SPELL:
      var spell = new bees.spellType(item)
      await spell.handleSelectFrom(server, interaction, castCache)
      return
  }
}

async function selectTo(server, interaction) {
  if (interaction.values.length != 1) {
    await interaction.update({ content: 'cannot select multiple values', components: [] })
    return
  }
  console.log("select-to interaction:", interaction)
  castToCache[interaction.message.interaction.id] = interaction.values[0]
  let from = castCache[interaction.message.interaction.id]
  console.log("from:", from)
  var item;
  try {
    item = await server.db.collection("items").findOne({
      id: from
    })
  } catch (error) {
    console.log("error:", error)
    await interaction.update({ content: `error: ${error} | talk to @hypervisor`, components: [], ephemeral: true })
    _cleanup(server, interaction)
    return
  }
  if (!item) {
    await interaction.reply({ content: "error: retry, if this persists @hypervisor", components: [], ephemeral: true })
    _cleanup(server, interaction)
    return
  }
  switch (item.type) {
    case ATTACK_SPELL:
      // pick target creature (in the future, include binding field or whatever)
      var spell = new attack.spellType(item)
      await spell.selectTo(server, interaction)
      return
    case CONJURE_ALLY_SPELL:
      var spell = new summon.spellType(item)
      await spell.selectTo(server, interaction)
      return
    case CONJURE_ENEMY_SPELL:
      var spell = new summon.spellType(item)
      await spell.selectTo(server, interaction)
      return
    case CONJURE_FREEZE_SPELL:
      var spell = new summon.spellType(item)
      await spell.selectTo(server, interaction)
      return
    case CULT_POINT_BOOST_SPELL:
      var spell = new cp_boost.spellType(item)
      await spell.selectTo(server, interaction)
      return
    case BEES_SPELL:
      var spell = new bees.spellType(item)
      await spell.selectTo(server, interaction)
      return
    case MAGIC_BOOST_SPELL:
      return
    case CHEST_SPELL:
      return
  }
}

async function _cleanup(server, interaction) {
  delete castCache[interaction.message.interaction.id]
  delete castToCache[interaction.message.interaction.id]
}

async function commit(server, interaction) {
  // get spells, display as list
  let from = castCache[interaction.message.interaction.id]
  console.log("from:", from)
  var item;
  try {
    item = await server.db.collection("items").findOne({
      id: from
    })
  } catch (error) {
    console.log("error:", error)
    await interaction.update({ content: `error: ${error} | talk to @hypervisor`, components: [], ephemeral: true })
    _cleanup(server, interaction)
    return
  }
  if (!item) {
    await interaction.reply({ content: "error: retry, if this persists @hypervisor", components: [], ephemeral: true })
    _cleanup(server, interaction)
    return
  }
  try {
    switch (item.type) {
      case ATTACK_SPELL:
        // pick target creature (in the future, include binding field or whatever)
        var spell = new attack.spellType(item)
        await spell.commit(server, interaction, castToCache)
        break
      case CONJURE_ALLY_SPELL:
        var spell = new summon.spellType(item)
        await spell.commit(server, interaction, castToCache)
        break
      case CONJURE_ENEMY_SPELL:
        var spell = new summon.spellType(item)
        await spell.commit(server, interaction, castToCache)
        break
      case CONJURE_FREEZE_SPELL:
        var spell = new summon.spellType(item)
        await spell.commit(server, interaction, castToCache)
        break
      case CULT_POINT_BOOST_SPELL:
        var spell = new cp_boost.spellType(item)
        await spell.commit(server, interaction, castToCache)
        break
      case MAGIC_BOOST_SPELL:
        var spell = new magic_boost.spellType(item)
        await spell.commit(server, interaction)
        break
      case CHEST_SPELL:
        var spell = new chest.spellType(item)
        await spell.commit(server, interaction)
        return
      case BEES_SPELL:
        var spell = new bees.spellType(item)
        await spell.commit(server, interaction, castToCache)
        return
    }
  } finally {
    let spellTypeName = item.metaType ? item.metaType : item.type
    let spellType = store.getSpellType(spellTypeName)
    let user = server.getUser(interaction.member.id)
    if(user){
      await spellType.issueCastPoints(user)
    }
  }
  _cleanup(server, interaction)
}

exports.cast = {
  start: start,
  selectFrom: selectFrom,
  selectTo: selectTo,
  commit: commit,
  cancel: cancel
}
// conjure
//    create spell item based on seed
// cast
//    get list of user's items (todo: can we tie an id to the item?)
//    execute item-specific casting flow
//      summon creature
//      -- creature channel
//      -- 
/*
/help (alias /menu)
/purse
/conjure
/cast
/equip (mask only rn)
*/

// /help

// points
  // seed points
    // for each user in mongo, get their chant count + 
  // add points
  // view points

// conjure (buy) spells

// cast spells

// new collections:
// creatures
// itemTypes (not needed?)
//   item-params from before
// events
//   chant
//   recruit
//   conjure

// 
// new fields
  // user.dust: current dust balance (generated by earning points)
  // user.points: total points earned

// levels
// white mask -- default
// blue mask -- 2 chants
// purple mask -- 10 dust
// black mask -- 20 points + 1 referral
// gold mask -- 40 points + 7 referrals
// illuminated mask -- 100 points + 13 referrals

// get points by:
// chanting +1
// referrals +3
// defeating monsters +variable (first 3 to react?)
// monsters drop items and points, you get them by reacting

// all spells:
// - prefix: corrupted, celestial,  
// - type: shards, eyes, 

// 2x, 3x, 5x, 10x chant multiplier for the day
// attack spells (1, 3, 6, 10 dmg -- 1,2 uses)
// +1-10 chant points
// +1-20 recruitment points (point cap: 50)
// 2x, 3x, 4x dust reward multiplier
