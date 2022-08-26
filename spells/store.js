const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const { server } = require('../server')
const { emoji } = require('../utils/emoji')
const { mariokart } = require('./mariokart')
const { bees } = require('./types/bees')
const { chest } = require('./types/chest')
const { summon } = require('./types/summon')
const { cp_boost } = require('./types/cp_boost')
const { magic_boost } = require('./types/magic_boost')
const { attack } = require('./types/attack')
const { StringMutex } = require('../utils/mutex')
const {
  CONJURE_ANCIENT_ENEMY_SPELL,
  CONJURE_ANCIENT_ALLY_SPELL,
  CONJURE_ENEMY_SPELL,
  CONJURE_ALLY_SPELL,
  CONJURE_FREEZE_SPELL,
  ATTACK_SPELL,
  STRONG_ATTACK_SPELL,
  MAGIC_BOOST_SPELL,
  CULT_POINT_BOOST_SPELL,
  CHEST_SPELL,
  BEES_SPELL,
  RANDOM_SPELL
} = require('./constants.js')
const { points } = require('./points')

class SpellType {
  constructor(id, name, description, price, castPoints, baseType=null, inStore=true, defeatXp){
    this.id = id
    this.name = name
    if(baseType){
      this.baseType = baseType
    } else {
      this.baseType = name
    }
    this.description = description,
    this.price = price
    this.inStore = inStore
    this.castPoints = castPoints
    this.defeatXp = defeatXp
  }
  
  setInStore(v){
    this.inStore = v
    return this
  }
  
  setEmoji(v){
    this.emoji = v
    return this
  }
  
  async issueCastPoints(user){
    if(this.castPoints > 0){
      await points.handleCastPoints(user)
    }
    return
  }
}

const ATTACK_SPELL_PRICE = 15
const STRONG_ATTACK_SPELL_PRICE = 30
const RANDOM_SPELL_PRICE = 45
const CHEST_SPELL_PRICE = 50
const CHAINS_SPELL_PRICE = 100
const CREATURE_SPELL_PRICE = 200
const ANCIENT_SPELL_PRICE = 400
const SUPER_ATTACK_SPELL_PRICE = 60

const ANCIENT_SPELL_CAST_XP = 6
const ANCIENT_DEFEAT_XP = 5
const CREATURE_SPELL_CAST_XP = 3
const CREATURE_DEFEAT_XP = 2
const CHAINS_SPELL_CAST_XP = 1

var SPELLS = {
  [RANDOM_SPELL]: new SpellType(
    RANDOM_SPELL, 
    '⍰ ⍰ ⍰',
    `conjure a random spell`,
    RANDOM_SPELL_PRICE,
    0
  ).setEmoji({name: '🎁'}), 
  [ATTACK_SPELL]: new SpellType(
    ATTACK_SPELL, 
    'attack spell',
    `deal damage to a target`,
    // `deal damage to a target (+${CHAINS_SPELL_CAST_XP}-${ANCIENT_SPELL_CAST_XP}XP on defeat)`,
    ATTACK_SPELL_PRICE,
    0
  ).setEmoji({name: '⚔️'}),
  [STRONG_ATTACK_SPELL]: new SpellType(
    STRONG_ATTACK_SPELL, 
    'strong attack spell',
    `deal strong damage to a target`,
    // `deal strong damage to a target (+${CHAINS_SPELL_CAST_XP}-${ANCIENT_SPELL_CAST_XP}XP on defeat)`,
    STRONG_ATTACK_SPELL_PRICE,
    0,
    ATTACK_SPELL
  ).setEmoji({name: '🪓'}),
  [CONJURE_FREEZE_SPELL]: new SpellType(
    CONJURE_FREEZE_SPELL,  
    `chains of abduction`,
    `abduct enemy cultists and prevent them from chanting (+${CHAINS_SPELL_CAST_XP}XP when cast)`,
    CHAINS_SPELL_PRICE,
    CHAINS_SPELL_CAST_XP
  ).setEmoji({name: '⛓'}),
  [CONJURE_ENEMY_SPELL]: new SpellType(
    CONJURE_ENEMY_SPELL, 
    `summoning eye`,
    `summon a monster to attack another cult's points (+${CREATURE_SPELL_CAST_XP}XP when cast)`,
    CREATURE_SPELL_PRICE,
    CREATURE_SPELL_CAST_XP,
    CONJURE_ENEMY_SPELL,
    true,
    CREATURE_DEFEAT_XP
  ).setEmoji({id: emoji.eye.id}),
  [CONJURE_ALLY_SPELL]: new SpellType(
    CONJURE_ALLY_SPELL,  
    `summoning shard`,
    `summon a helpful ally to charge your cult's points (+${CREATURE_SPELL_CAST_XP}XP when cast)`,
    CREATURE_SPELL_PRICE,
    CREATURE_SPELL_CAST_XP,
    CONJURE_ALLY_SPELL,
    true,
    CREATURE_DEFEAT_XP
  ).setEmoji({id: emoji.shard.id}),
  [CONJURE_ANCIENT_ENEMY_SPELL]: new SpellType(
    CONJURE_ANCIENT_ENEMY_SPELL, 
    `corrupted summoning eye`,
    `summon an Ancient to attack another cult's points (+${ANCIENT_SPELL_CAST_XP}XP when cast)`,
    ANCIENT_SPELL_PRICE,
    ANCIENT_SPELL_CAST_XP,
    CONJURE_ENEMY_SPELL,
    true,
    ANCIENT_DEFEAT_XP
  ).setEmoji({id: emoji.corrupted_eye.id}),
  [CONJURE_ANCIENT_ALLY_SPELL]: new SpellType(
    CONJURE_ANCIENT_ALLY_SPELL, 
    `celestial summoning shard`,
    `summon an Ancient to charge your cult's points (+${ANCIENT_SPELL_CAST_XP}XP when cast)`,
    ANCIENT_SPELL_PRICE,
    ANCIENT_SPELL_CAST_XP,
    CONJURE_ALLY_SPELL,
    true,
    ANCIENT_DEFEAT_XP
  ).setEmoji({id: emoji.celestial_shard.id}),
  [CULT_POINT_BOOST_SPELL]: new SpellType(
    CULT_POINT_BOOST_SPELL, 
    'aura',
    `temporarily boost the cult points you generate (1.2-4X / 24 hours)`,
    0,
    0
  ).setInStore(false),
  [CHEST_SPELL]: new SpellType(
    CHEST_SPELL, 
    'chest',
    `conjure a chest that can be unlocked with help from your fellow cultists`,
    CHEST_SPELL_PRICE,
    0
  ).setInStore(false),
  [MAGIC_BOOST_SPELL]: new SpellType(
    MAGIC_BOOST_SPELL, 
    'charm',
    `temporarily boost the cult points you generate (1.2-4X / 24 hours)`,
    0,
    0
  ).setInStore(false),
  [BEES_SPELL]: new SpellType(
    BEES_SPELL, 
    'bees',
    `unleash bees on an unsuspecting cultist`,
    0,
    0
  ).setInStore(false)
}

var MinSpellPrice = 15

for (const [_, v] of Object.entries(SPELLS)){
  if(v.inStore && v.price < MinSpellPrice){
    MinSpellPrice = v.price 
  }
}

async function handleConjureRequest(interaction) {
  console.log("handle conjure request")
  try {
    await interaction.deferReply({ ephemeral: true })
  } catch(err){
    console.log("error:", err)
    return
  }
  let user = await server.db.collection("users").findOne({ "discord.userid": interaction.member.id })
  if (!user) {
    await interaction.editReply({ content: 'user not found, talk to @hypervisor...', ephemeral: true })
    return
  }
  if (user.coins < MinSpellPrice) {
    await interaction.editReply({ content: `not enough magic <:magic:975922950551244871>. the least expensive conjure costs <:magic:975922950551244871>${DEFAULT_SPELL_PRICE} magic. you have <:magic:975922950551244871>${user.coins},,,`, ephemeral: true })
    return
  }
  let userCult = server.Cults.userCult(interaction.member)
  console.log("user cult:", userCult)
  if (user.cult_id === "" || !userCult) {
    await interaction.editReply({ content: `no cult assigned`, ephemeral: true })
    return
  }
  let options = []
  for(const [_, v ] of Object.entries(SPELLS)){
    if(v.inStore){
      options.push({
        value: v.id,
        emoji: v.emoji,
        label: v.name,
        description: `${v.price}✨ | ${v.description}`
      })
    }
  }
  
  let embed = new MessageEmbed()
    .setDescription(`you have <:magic:975922950551244871>${user.coins}. spend it wisely...`)
  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
          .setCustomId('conjure_select')
          .setPlaceholder('conjure a spell')
          .addOptions(options)
    )
  // const secondRow = new MessageActionRow()
  //   .addComponents(
  //     new MessageButton()
  //       .setCustomId('default_cancel')
  //       .setLabel('cancel')
  //       .setStyle('SECONDARY')
  //   )
  console.log("editing reply")
  await interaction.editReply({ content: `you have <:magic:975922950551244871>${user.coins}. spend it wisely...`, embeds: [], components: [row], ephemeral: true })
  console.log("edited reply")
}

function spellMessageEmbed(spell) {
  let spellType = SPELLS[spell.metaType ? spell.metaType : spell.type]
  console.log("descrption:",  spellType.description)
  return new MessageEmbed()
    .setTitle(spell.name)
    .setColor("#FFFFE0")
    .setDescription(spellType.description)
}

async function conjure(server, spellType, member) {
  let roles = await mariokart.rollDice(server, member, 2)
  let price = spellType.price
  if(spellType.id == RANDOM_SPELL){
    spellType = SPELLS[mariokart.selectSpell(roles[0]).value]
  }
  console.log("spellType:", spellType)
  var spell;
  switch (spellType.id) {
    case CONJURE_ANCIENT_ENEMY_SPELL:
      spell = summon.enemyGenerator.create(roles[1] * 0.05 + 0.95)
      spell.metaType = CONJURE_ANCIENT_ENEMY_SPELL
      break
    case CONJURE_ANCIENT_ALLY_SPELL:
      spell = summon.allyGenerator.create(roles[1] * 0.05 + 0.95)
      spell.metaType = CONJURE_ANCIENT_ALLY_SPELL
      break
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
    case STRONG_ATTACK_SPELL:
      spell = attack.generator.create(roles[1] * 0.7 + 0.3)
      spell.metaType = STRONG_ATTACK_SPELL
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
    await server.db.collection("users").update({ 'discord.userid': member.id }, { $inc: { coins: -price } })
  } catch (error) {
    console.log(error)
    return error
  }
  return spell
}

const UserMutex = new StringMutex()
async function handleConjureSelect(interaction) {
  if (interaction.values.length != 1) {
    await interaction.update({ content: 'cannot select multiple values', components: [], ephemeral: true })
    return
  }
  let spellType = SPELLS[interaction.values[0]]
  if(!spellType){
    await interaction.update({ content: 'no spell found | talk to @hypervisor about this...', components: [], ephemeral: true })
    return
  }
  
  await interaction.deferReply({ ephemeral: true })
  var release = await UserMutex.acquire(interaction.member.id)
  try {
    
    // Validate request
    let c = await server.db.collection("items").count({ owner: interaction.member.id })
    if (c >= 10) {
      await interaction.editReply({ content: 'you have the maximum number of spells. you must /cast or /drop some to conjure again.', components: [], ephemeral: true })
      return
    }
    let user = await server.db.collection("users").findOne({ "discord.userid": interaction.member.id })
    if (!user) {
      await interaction.editReply({ content: 'user not found, talk to @hypervisor...', components: [], ephemeral: true })
      return
    }
    if (!server.Cults.userCult(interaction.member)) {
      await interaction.editReply({ content: `no cult assigned`, components: [], ephemeral: true })
      return
    }
    if (user.coins < spellType.price) {
      await interaction.editReply({ content: `not enough magic <:magic:975922950551244871>. ${spellType.name} costs <:magic:975922950551244871>${spell.price} magic. you have <:magic:975922950551244871>${user.coins},,,`, components: [], ephemeral: true })
      return
    }
    let spell = await conjure(server, spellType, interaction.member)
    console.log("spell:", spell)
    let embed = spellMessageEmbed(spell)
    await interaction.editReply({ content: 'what magic have you conjured?', embeds: [embed], components: [], ephemeral: true })
  } finally {
    release()
  }
}

exports.store = {
  handleConjureRequest: handleConjureRequest,
  handleConjureSelect: handleConjureSelect,
  getSpellType: (name) => {
    return SPELLS[name]
  }
}