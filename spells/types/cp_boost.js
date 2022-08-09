const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const { adventure } = require('../adventure')
const { RandGenerator } = require('../../utils/rand')

const {
  TARGET_PLAYER_TYPE,
  CULT_POINT_BOOST_SPELL,
} = require('../constants.js')
const { points } = require('../points')
const { SpellGenerator, prefixes, suffixes, gods } = require('../generator')

class CultPointBoostSpell {
  constructor(spell) {
    this.spell = spell
  }
  async handleSelectFrom(server, interaction, castCache) {
    // console.log("interaction before defer reply:", interaction)
    // await interaction.deferReply({ ephemeral: true })
    let active = await points.getActiveCultBoost(server, interaction.member.id)
    if (active) {
      castCache[interaction.message.interaction.id] = this.spell.id
      var cult = server.Cults.userCult(interaction.member)
      let _24hrago = new Date(new Date().getTime() - (24 * 60 * 60 * 1000))
      let users = await server.db.collection("users").aggregate([
        {
          "$match": {
            "cult_id": cult.id,
            "discord.userid": { $exists: true, $ne: '', $nin: server.admins, $ne: interaction.member.id }
          }
        },
        {
          "$lookup": {
            from: 'events',
            let: { 'userid': '$discord.userid' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$spell_type", CULT_POINT_BOOST_SPELL] },
                      { $gte: ["$timestamp", _24hrago] },
                      { $eq: ["$$userid", "$metadata.target.id"] }
                    ]
                  }
                }
              }
            ],
            as: 'boosts'
          }
        },
        {
          "$match": {
            $or: [
              { boosts: { $exists: false } },
              { boosts: null },
              { boosts: { $size: 0 } }
            ]
          }
        },
        {
          $sort: {
            points: -1,
            num_chants: -1
          }
        },
        {
          $limit: 20
        }
      ])
      users = await users.toArray()
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
          // new MessageButton()
          //   .setCustomId('cast_cancel')
          //   .setLabel('Cancel')
          //   .setStyle('SECONDARY')
        );
      const secondRow = new MessageActionRow()
        .addComponents(
          new MessageButton()
            .setCustomId('cast_cancel')
            .setLabel('Cancel')
            .setStyle('SECONDARY')
        )
      try {
        await interaction.update({ content: `you already have a boost active, boost another cult member?`, components: [row, secondRow], ephemeral: true })
      } catch (err) {
        console.log("error")
      }
      // await interaction.editReply({ content: `you already have a boost active, boost another cult member?`, components: [row, secondRow], ephemeral: true })
      // console.log("interaction after edit reply:", interaction)
      // await interaction.update({ content: `you already have a boost active`, components: [], ephemeral:true })
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
    await interaction.update({ content: `cast ${this.spell.name} | boost: x${this.spell.metadata.boost} cult points | duration: 24hrs`, components: [row], ephemeral: true })
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
    console.log("commit cp boost spell - this.spell:", this.spell)
    let target = castToCache[interaction.message.interaction.id]
    if (!target) {
      target = interaction.member.id
    }
    console.log("target:", target)
    var member = server.getMember(target)
    if (!member) {
      await interaction.editReply({ content: `error: couldn't find cultist | talk to @hypervisor`, components: [], ephemeral: true })
      return
    }
    let active = await points.getActiveCultBoost(server, member.id)
    if (active) {
      interaction.editReply({ content: 'a boost is currently active for ' + member.displayName, components: [], ephemeral: true })
      return
    }

    try {
      await server.db.collection("events").insertOne({
        "metadata": { "user": interaction.member.id, "spell": this.spell, "target": { type: TARGET_PLAYER_TYPE, id: target } },
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
    adventure.log(server, `${interaction.member} cast ${this.spell.name} on ${member} (cult point boost: x${this.spell.metadata.boost})`)
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

var CPBoostSpellCreator = new SpellGenerator(
  CULT_POINT_BOOST_SPELL,
  ["Amplifying"], ["Aura"],
  ["Blessed"],
  ["of Hope"],
  gods,
  (spell) => {
    // map power to damage
    spell.metadata = { boost: (spellDamage(spell) / 11 * 2.8 + 1.2).toFixed(1) }
  }
)

exports.cp_boost = {
  spellType: CultPointBoostSpell,
  generator: CPBoostSpellCreator
}