const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const { adventure } = require('../adventure')
const { RandGenerator } = require('../../utils/rand')

const {
  TARGET_PLAYER_TYPE,
  MAGIC_BOOST_SPELL,
} = require('../constants.js')
const { points } = require('../points')
const { SpellGenerator, prefixes, suffixes, gods } = require('../generator')

class MagicBoostSpell {
  constructor(spell) {
    this.spell = spell
  }
  async handleSelectFrom(server, interaction, castCache) {
    let active = await points.getActiveMagicBoost(server, interaction.member.id)
    if (active) {
      await interaction.update({ content: `you already have a boost active`, components: [], ephemeral: true })
      return
    }
    castCache[interaction.message.interaction.id] = this.spell.id
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

    await interaction.update({ content: `cast ${this.spell.name} | boost: +${this.spell.metadata.boost} magic | duration: 24hrs`, components: [row], ephemeral: true })
  }

  async commit(server, interaction, castToCache) {
    await interaction.deferReply({ ephemeral: true })
    console.log("commit conjuring spell - this.spell:", this.spell)

    // delete spell
    await server.db.collection("items").remove({ id: this.spell.id })

    try {
      await server.db.collection("events").insertOne({
        "metadata": { "user": interaction.member.id, "spell": this.spell, "target": { type: TARGET_PLAYER_TYPE, id: interaction.member.id } },
        "timestamp": new Date(),
        "spell_type": this.spell.type,
        "event": "cast"
      })
    } catch (error) {
      console.log("insert event error:", error)
      return
    }

    try {
      interaction.editReply({ content: `${this.spell.name} was cast!`, components: [], ephemeral: true })
    } catch (error) {
      console.log("castConfirm interaction.reply error:", error)
    }
    adventure.log(server, `${interaction.member} cast ${this.spell.name} (magic boost: +${this.spell.metadata.boost})`)
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

var magicBoostSpellCreator = new SpellGenerator(
  MAGIC_BOOST_SPELL,
  ["Divining"], ["Charm"],
  ["Faerie"],
  ["of Power"],
  gods,
  (spell) => {
    // map power to damage
    spell.metadata = { boost: Math.round(spellDamage(spell) / 2) }
  }
)

exports.magic_boost = {
  spellType: MagicBoostSpell,
  generator: magicBoostSpellCreator
}