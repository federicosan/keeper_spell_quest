const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const { mariokart } = require('./mariokart')
const { bees } = require('./types/bees')
const { chest } = require('./types/chest')
const { summon } = require('./types/summon')
const { cp_boost } = require('./types/cp_boost')
const { magic_boost } = require('./types/magic_boost')
const { attack } = require('./types/attack')

const {
  CONJURE_ANCIENT_ENEMY_SPELL,
  CONJURE_ANCIENT_ALLY_SPELL,
  CONJURE_ENEMY_SPELL,
  CONJURE_ALLY_SPELL,
  CONJURE_FREEZE_SPELL,
  ATTACK_SPELL,
  MAGIC_BOOST_SPELL,
  CULT_POINT_BOOST_SPELL,
  CHEST_SPELL,
  BEES_SPELL,
  RANDOM_SPELL
} = require('./constants.js')
const { points } = require('./points')
const { objects } = require('./objects')
const { StringMutex } = require('../utils/mutex')

var SpellDescriptions = {
  [CONJURE_ENEMY_SPELL]: "summon a monster to attack another cult's points",
  [CONJURE_ALLY_SPELL]: "summon a helpful ally that charges your points as long as it stays alive",
  [MAGIC_BOOST_SPELL]: "temporarily boost the magic you earn (+1-6 / 24 hours)",
  [CULT_POINT_BOOST_SPELL]: "temporarily boost the cult points you generate (1.2-4X / 24 hours)",
  [ATTACK_SPELL]: "deal damage to a target",
  [CHEST_SPELL]: "conjure a chest that can be unlocked with help from your fellow cultists",
  [CONJURE_FREEZE_SPELL]: "abduct enemy cultists and prevent them from chanting",
  [BEES_SPELL]: "unleash bees on an unsuspecting cultist"
}

class Spell {
  constructor(name, incantation, power, type) {
    this.name = name
    this.incantation = incantation
    this.power = power
    this.type = type
  }

}
// 9
var spell = [
  // defense
  "Ward",
  // attack
  "Spike",
  "Bane",
  "Bolt",
  // conjuring
  "Shard",
  "Rune",
  // boost
  "Aura",
  // cursing
  "Charm",
  "Hex",
  "Eye"
];

const DEFAULT_SPELL_PRICE = 15

async function _conjure(server, member) {
  let roles = await mariokart.rollDice(server, member, 2)
  console.log("roles:", roles)
  let spellType = mariokart.selectSpell(roles[0])
  console.log("spellType:", spellType)
  var spell;
  switch (spellType.value) {
    case CONJURE_ENEMY_SPELL:
      spell = summon.enemyGenerator.create(roles[1])
      break
    case CONJURE_ALLY_SPELL:
      spell = summon.allyGenerator.create(roles[1])
      break
    case CONJURE_FREEZE_SPELL:
      spell = summon.freezeGenerator.create(roles[1])
      break
    case ATTACK_SPELL:
      spell = attack.generator.create(roles[1])
      break
    case MAGIC_BOOST_SPELL:
      spell = magic_boost.generator.create(roles[1])
      break
    case CULT_POINT_BOOST_SPELL:
      spell = cp_boost.generator.create(roles[1])
      break
    case CHEST_SPELL:
      spell = chest.generator.create(roles[1])
      break
    case BEES_SPELL:
      spell = bees.generator.create(roles[1])
      break
  }
  spell.id = await server.getNextSequenceValue("items")
  spell.owner = member.id
  console.log("spell:", spell)
  try {
    await server.db.collection("items").insertOne(spell)
  } catch (error) {
    console.log(error)
    return error
  }
  try {
    await server.db.collection("users").update({ 'discord.userid': member.id }, { $inc: { coins: -DEFAULT_SPELL_PRICE } })
  } catch (error) {
    console.log(error)
    return error
  }
  return spell
}

function spellMessageEmbed(spell) {
  console.log("descrption:", SpellDescriptions[spell.type])
  return new MessageEmbed()
    .setTitle(spell.name)
    .setColor("#FFFFE0")
    .setDescription(SpellDescriptions[spell.type])
}

const UserMutex = new StringMutex()

async function conjure(server, interaction) {
  await interaction.deferReply({ ephemeral: true })
  // verify user has the dust required + inventory-slots available
  
  var release = await UserMutex.acquire(interaction.member.id)
  try {
    let c = await server.db.collection("items").count({ owner: interaction.member.id })
    if (c >= 10) {
      await interaction.editReply({ content: 'you have the maximum number of spells. you must /cast or /drop some to conjure again.', components: [], ephemeral: true })
      return
    }
  
    let user = await server.db.collection("users").findOne({ "discord.userid": interaction.member.id })
    if (!user) {
      await interaction.editReply({ content: 'user not found, talk to @hypervisor...', ephemeral: true })
      return
    }
    if (user.coins < DEFAULT_SPELL_PRICE) {
      await interaction.editReply({ content: `not enough magic <:magic:975922950551244871>. spells cost <:magic:975922950551244871>${DEFAULT_SPELL_PRICE} magic. you have <:magic:975922950551244871>${user.coins},,,`, ephemeral: true })
      return
    }
    let userCult = server.Cults.userCult(interaction.member)
    console.log("user cult:", userCult)
  
    console.log("member:", interaction.member)
    if (!userCult) {
      await interaction.editReply({ content: `no cult assigned`, components: [], ephemeral: true })
      return
    }
    let spell = await _conjure(server, interaction.member)
    console.log("spell:", spell)
    let embed = spellMessageEmbed(spell)
    await interaction.editReply({ content: 'what magic have you conjured?', embeds: [embed], components: [], ephemeral: true })
  } finally {
    release()
  }
}

async function handleConjureRequest(server, interaction) {
  console.log("handle conjure request")
  await interaction.deferReply({ ephemeral: true })
  let user = await server.db.collection("users").findOne({ "discord.userid": interaction.member.id })
  if (!user) {
    await interaction.editReply({ content: 'user not found, talk to @hypervisor...', ephemeral: true })
    return
  }
  if (user.coins < DEFAULT_SPELL_PRICE) {
    await interaction.editReply({ content: `not enough magic <:magic:975922950551244871>. spells cost <:magic:975922950551244871>${DEFAULT_SPELL_PRICE} magic. you have <:magic:975922950551244871>${user.coins},,,`, ephemeral: true })
    return
  }
  let userCult = server.Cults.userCult(interaction.member)
  console.log("user cult:", userCult)
  if (user.cult_id === "" || !userCult) {
    await interaction.editReply({ content: `no cult assigned`, ephemeral: true })
    return
  }
  let embed = new MessageEmbed()
    .setTitle("conjure a spell ")
    .setColor("#FFFFE0")
    .setDescription(`spells cost <:magic:975922950551244871>${DEFAULT_SPELL_PRICE} magic. you have <:magic:975922950551244871>${user.coins}. continue?`)
  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('spells_conjure_1')
        .setLabel('conjure')
        .setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId('default_cancel')
        .setLabel('leave')
        .setStyle('SECONDARY')
    );
  console.log("editing reply")
  await interaction.editReply({ content: 'continue', embeds: [embed], components: [row], ephemeral: true })
  console.log("edited reply")
}

async function testConjure(spellType, roles) {
  if (!roles) {
    roles = [Math.random(), Math.random()]
  }
  if (!spellType) {
    spellType = mariokart.selectSpell(roles[0], true)
    console.log("spellType:", spellType.value)
  }
  var spell;
  switch (spellType.value) {
    case CONJURE_ENEMY_SPELL:
      spell = summon.enemyGenerator.create(roles[1])
      break
    case CONJURE_ALLY_SPELL:
      spell = summon.allyGenerator.create(roles[1])
      break
    case CONJURE_FREEZE_SPELL:
      spell = summon.freezeGenerator.create(roles[1])
      break
    case ATTACK_SPELL:
      spell = attack.generator.create(roles[1])
      break
    case MAGIC_BOOST_SPELL:
      spell = magic_boost.generator.create(roles[1])
      break
    case CULT_POINT_BOOST_SPELL:
      spell = cp_boost.generator.create(roles[1])
      break
    case CHEST_SPELL:
      spell = chest.generator.create(roles[1])
      break
    case BEES_SPELL:
      spell = bees.generator.create(roles[1])
      break
    default:
      throw new Error("no type input: " + spellType.value)
  }
  console.log("spell:", spell)
  return { roles, spell }
}

exports.spells = {
  conjure: conjure,
  handleConjureRequest: handleConjureRequest,
  SpellDescriptions: SpellDescriptions
}

exports.testSpells = {
  conjure: testConjure,
  rollDice: mariokart.roll
}
