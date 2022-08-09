const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const { adventure } = require('../adventure')

const {
  TARGET_CULT_TYPE,
  CHEST_SPELL,
} = require('../constants.js')
const { objects } = require('../objects')
const { SpellGenerator, gods } = require('../generator')

class ChestSpell {
  constructor(spell) {
    this.spell = spell
  }
  async handleSelectFrom(server, interaction, castCache) {
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

    await interaction.update({ content: `cast ${this.spell.name}`, components: [row], ephemeral: true })
  }

  async commit(server, interaction, castToCache) {
    await interaction.deferReply({ ephemeral: true })
    console.log("commit conjuring spell - this.spell:", this.spell)
    let cult = server.userIdCult(interaction.member.id)
    let object = await objects.createChest(this.spell.power, cult, interaction.member.id)
    try {
      await server.db.collection("events").insertOne({
        "metadata": { "user": interaction.member.id, "spell": this.spell, "object": object.id, "target": { type: TARGET_CULT_TYPE, id: cult.id } },
        "timestamp": new Date(),
        "spell_type": this.spell.type,
        "event": "cast"
      })
    } catch (error) {
      console.log("insert event error:", error)
      return
    }

    // delete spell
    await server.db.collection("items").remove({ id: this.spell.id })

    try {
      interaction.editReply({ content: `${this.spell.name} was cast!`, components: [], ephemeral: true })
    } catch (error) {
      console.log("castConfirm interaction.reply error:", error)
    }
    adventure.log(server, `${interaction.member} cast ${this.spell.name} and summoned a Locked Chest ${object.rewardEmoji()}`)
  }
}

var chestSpellCreator = new SpellGenerator(
  CHEST_SPELL,
  ["Conjure"],
  ["Chest"],
  ["Gilded"],
  ["of Wealth"],
  gods,
)

exports.chest = {
  spellType: ChestSpell,
  generator: chestSpellCreator
}