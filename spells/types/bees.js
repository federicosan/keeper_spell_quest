const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const { adventure } = require('../adventure')
const { bees } = require('../bees')
const { cache } = require('./cache')

const {
  TARGET_PLAYER_TYPE,
  BEES_SPELL
} = require('../constants.js')
const { SpellGenerator, prefixes, suffixes, gods } = require('../generator')

class BeesSpell {
  constructor(spell) {
    this.spell = spell
  }
  async handleSelectFrom(server, interaction, castCache) {
    castCache[interaction.message.interaction.id] = this.spell.id
    var cult = server.Cults.userCult(interaction.member)
    let users = cache.CultBeesTargets[cult.id]
    console.log("users:", users)
    var options = []
    for (const user of users) {
      var _cult = server.Cults.get(user.cult_id)
      if (!_cult) {
        console.log("no cult for user:", user)
        continue
      }
      var member = server.getMember(user.discord.userid)
      if (!member) {
        continue
      }
      options.push({
        value: user.discord.userid,
        emoji: _cult.emojiId ? { id: _cult.emojiId } : { name: _cult.emoji },
        label: member.displayName.substring(0, 20)
      })
    }
    const row = new MessageActionRow()
      .addComponents(
        new MessageSelectMenu()
          .setCustomId('cast_select_to')
          .setPlaceholder('target cultist')
          .addOptions(options)
      );
    const secondRow = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId('cast_cancel')
          .setLabel('Cancel')
          .setStyle('SECONDARY')
      )
    try {
      await interaction.update({ content: `set bees on an enemy cultist`, components: [row, secondRow], ephemeral: true })
    } catch (err) {
      console.log("error")
    }
    return
  }

  async selectTo(server, interaction) {
    if (interaction.values.length != 1) {
      await interaction.update({ content: 'cannot select multiple values', components: [] })
      return
    }
    var member = server.getMember(interaction.values[0])
    if (!member) {
      await interaction.update({ content: `error: couldn't find cultist | talk to @hypervisor`, components: [], ephemeral: true })
      return
    }
    var target = `${member}`

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

    await interaction.update({ content: `cast ${this.spell.name} on ${target}`, components: [row], ephemeral: true })
  }

  async commit(server, interaction, castToCache) {
    await interaction.deferReply({ ephemeral: true })
    console.log("commit bees spell - this.spell:", this.spell)
    let target = castToCache[interaction.message.interaction.id]
    if (!target) {
      await interaction.editReply({ content: `error: no target set | talk to @hypervisor`, components: [], ephemeral: true })
      return
    }
    console.log("target:", target)
    var member = server.getMember(target)
    if (!member) {
      await interaction.editReply({ content: `error: couldn't find cultist | talk to @hypervisor`, components: [], ephemeral: true })
      return
    }
    let active = await bees.isBesetByBees(interaction.member)
    if (active) {
      interaction.editReply({
        content: `${member.displayName} already beset by bees`,
        components: [],
        ephemeral: true
      })
      return
    }

    let durationHrs = Math.max(6, this.spell.power * 16 + Math.random() * this.spell.power * 4 + Math.random() * 2)
    let endTime = new Date(new Date().getTime() + Math.round(durationHrs * 60 * 60 * 1000))

    try {
      await server.db.collection("events").insertOne({
        "metadata": {
          "user": interaction.member.id,
          "spell": this.spell,
          "target": { type: TARGET_PLAYER_TYPE, id: target },
          "end": endTime
        },
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
    adventure.log(server, `${interaction.member} set bees 🐝 upon ${member} ( ${durationHrs.toFixed(1)}hrs )`)
  }
}

var beesSpellCreator = new SpellGenerator(
  BEES_SPELL,
  ["Conjure"],
  ["Bees"],
  ["Perturbed"],
  ["of Nuisance"],
  gods,
)

exports.bees = {
  spellType: BeesSpell,
  generator: beesSpellCreator
}