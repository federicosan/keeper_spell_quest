const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const { RandGenerator } = require('../../utils/rand')
const { adventure } = require('../adventure')
const { creatures } = require('../creatures')

const {
  ENEMY_TYPE,
  ALLY_TYPE,
  FREEZE_TYPE,
  TARGET_CULT_TYPE,
  TARGET_PLAYER_TYPE,
  TARGET_CREATURE_TYPE,
  ATTACK_SPELL
} = require('../constants.js')
const { SpellGenerator, prefixes, suffixes, gods } = require('../generator')

class AttackSpell {
  constructor(spell) {
    this.spell = spell
  }
  async handleSelectFrom(server, interaction, castCache) {
    castCache[interaction.message.interaction.id] = this.spell.id
    let cult = server.userIdCult(interaction.member.id)
    let creatures = await server.db.collection("creatures").find({
      $and: [
        {
          $or: [
            { 'target.type': TARGET_CULT_TYPE, 'target.id': cult.id, 'type': ENEMY_TYPE },
            { 'target.type': TARGET_CULT_TYPE, 'target.id': { $ne: cult.id }, 'type': ALLY_TYPE },
            { 'target.type': TARGET_PLAYER_TYPE, 'target.id': { $ne: interaction.member.id }, 'type': FREEZE_TYPE }
          ]
        },
        { healthRemaining: { $gt: 0 } }
      ]
    }).sort({ type: -1 }).limit(24)
    var options = []
    if (creatures) {
      options = await creatures.map(creature => {
        if (creature.type == FREEZE_TYPE) {
          let member = server.getMember(creature.target.id)
          if (!member) {
            console.log("missing target member:", creature.target.id)
            return null
          }
          let _cult = server.Cults.userCult(member)
          return {
            value: creature.id,
            emoji: `${"⛓"}`,
            label: `${_cult.emoji} ${creature.name}`,
            description: `♥︎${creature.healthRemaining}/${creature.health} | ${"abducted"} ${member.displayName}`
          }
        } else {
          var _cult = server.Cults.get(creature.target.id)
          return {
            value: creature.id,
            emoji: `${creature.type == ALLY_TYPE ? "🌱" : "⚔️"}`,
            label: `${_cult.emoji} ${creature.name}`,
            description: `♥︎${creature.healthRemaining}/${creature.health} | ${creature.type == ALLY_TYPE ? "🌱" : "⚔️"} ${_cult.getName(server)}`
          }
        }
      }).toArray()
    }
    //console.log("handleSelectFrom options:", options)
    options = options.filter(op => op != null)
    if (options.length == 0) {
      await interaction.update({ content: `no targets available to cast ${this.spell.name} on...`, components: [], ephemeral: true })
      return
    }
    const row = new MessageActionRow()
      .addComponents(
        new MessageSelectMenu()
          .setCustomId('cast_select_to')
          .setPlaceholder('target')
          .addOptions(options)
      );
    await interaction.update({ content: `${this.spell.name} selected! select target...`, components: [row], ephemeral: true })
  }

  async selectTo(server, interaction) {
    if (interaction.values.length != 1) {
      await interaction.update({ content: 'cannot select multiple values', components: [] })
      return
    }
    var creature;
    try {
      creature = await server.db.collection("creatures").findOne({
        id: interaction.values[0]
      })
    } catch (error) {
      console.log("creature find error:", error)
      await interaction.update({ content: `error: ${error} | talk to @hypervisor`, components: [], ephemeral: true })
      return
    }
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

    await interaction.update({ content: `cast ${this.spell.name} on ${creature.name}`, components: [row], ephemeral: true })
  }

  async commit(server, interaction, castToCache) {
    await interaction.deferReply({ ephemeral: true })
    let target = castToCache[interaction.message.interaction.id]
    if (!target) {
      console.log("no target found")
      interaction.editReply({ content: 'no spell target found, talk to hypervisor', components: [], ephemeral: true })
      return
    }

    // damage monster
    var creature = await creatures.handleDamage(server, target, this.spell.metadata.damage)

    // delete spell
    await server.db.collection("items").remove({ id: this.spell.id })

    try {
      await server.db.collection("events").insertOne({
        "metadata": { "user": interaction.member.id, "spell": this.spell, "target": { type: TARGET_CREATURE_TYPE, id: target } },
        "timestamp": new Date(),
        "spell_type": this.spell.type,
        "event": "cast"
      })
    } catch (error) {
      console.log("insert event error:", error)
      return
    }

    if (creature.healthRemaining <= 0) {
      try {
        interaction.editReply({ content: `${creature.name} defeated!`, components: [], ephemeral: true })
      } catch (error) {
        console.log("castConfirm interaction.reply error:", error)
      }
    } else {
      try {
        interaction.editReply({ content: `${creature.name} was hurt! see <#${creature.channelId}>`, components: [], ephemeral: true })
      } catch (error) {
        console.log("castConfirm interaction.reply error:", error)
      }
    }
    adventure.log(server, `${interaction.member} cast ${this.spell.name} on ${creature.name} (${-this.spell.metadata.damage})`)
  }
}

function spellDamage(spell) {
  let rand = Math.round(Number.MAX_SAFE_INTEGER * spell.power)
  let randomizer = new RandGenerator(rand.toString() + "spell-damage-generator")
  let greatness = Math.floor(spell.power * 21)
  var strength = Math.max(1, Math.round(1.4 * (spell.power * 7 + (randomizer.rand() * spell.power * 4) + (randomizer.rnd() * 1))))
  if (greatness >= 16) {
    strength += 2;
  }
  return strength
}

var attackSpellCreator = new SpellGenerator(
  ATTACK_SPELL,
  ["Frost", "Ash", "Fire", "Poison", "Lightning"],
  ["Spike", "Bane", "Bolt"],
  prefixes,
  suffixes,
  gods,
  (spell) => {
    // map power to damage
    spell.metadata = { damage: spellDamage(spell) }
  }
)

exports.attack = {
  spellType: AttackSpell,
  generator: attackSpellCreator
}