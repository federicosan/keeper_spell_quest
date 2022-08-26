const { server } = require('../server')
const { emoji } = require('../utils/emoji')
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
}

const ATTACK_SPELL_PRICE = 15
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
    '⍰ ⍰ ⍰'
    `conjure a random spell`,
    RANDOM_SPELL_PRICE,
    0
  ), 
  [ATTACK_SPELL]: new SpellType(
    ATTACK_SPELL, 
    'attack spell'
    `deal damage to a target (+${CHAINS_SPELL_CAST_XP}-${ANCIENT_SPELL_CAST_XP}XP on defeat)`,
    ATTACK_SPELL_PRICE,
    0
  ).setEmoji({name: '⚔️'}),
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
  [CONJURE_FREEZE_SPELL]: new SpellType(
    CONJURE_FREEZE_SPELL,  
    `chains of abduction`,
    `abduct enemy cultists and prevent them from chanting (+${CHAINS_SPELL_CAST_XP}XP when cast)`,
    CHAINS_SPELL_PRICE,
    CHAINS_SPELL_CAST_XP
  ).setEmoji({name: '⛓'}),
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
  await interaction.deferReply({ ephemeral: true })
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
        description: `${v.price}${emoji.magic} | ${v.description}`
      })
    }
  }
  
  let embed = new MessageEmbed()
    .setTitle("conjure a spell ")
    .setColor("#FFFFE0")
    .setDescription(`you have <:magic:975922950551244871>${user.coins}. spend it wisely...`)
  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
          .setCustomId('conjure_select')
          .setPlaceholder('select spell')
          .addOptions(options)
    )
  const secondRow = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('default_cancel')
        .setLabel('cancel')
        .setStyle('SECONDARY')
    )
  console.log("editing reply")
  await interaction.editReply({ content: 'continue', embeds: [embed], components: [row, secondRow], ephemeral: true })
  console.log("edited reply")
}

async function handleConjureSelect(interaction) {
  
}

exports.store = {
  handleConjureRequest: handleConjureRequest,
  handleConjureSelect: handleConjureSelect
}