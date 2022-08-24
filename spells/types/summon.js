const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')

const { adventure } = require('../adventure')
const { creatures } = require('../creatures')
const { cache } = require('./cache')

const {
  ENEMY_TYPE,
  ALLY_TYPE,
  FREEZE_TYPE,
  CONJURE_ENEMY_SPELL,
  CONJURE_ALLY_SPELL,
  CONJURE_FREEZE_SPELL,
} = require('../constants.js')
const { SpellGenerator, gods } = require('../generator')

function sectionChannelCount(server, channelId) {
  //let children = this.guild.channels.cache.filter(c => c.parentId === channelId)
  let channel = server.getChannel(channelId)
  if (channel) {
    console.log("channel:", channel, "children.size:", channel.children.size)
    return channel.children.size
  }
  console.log("no channel")
  return 50
}

class SummoningSpell {
  constructor(spell) {
    this.spell = spell
  }
  async handleSelectFrom(server, interaction, castCache) {
    if (sectionChannelCount(server, server.channels.DungeonSectionId) >= 50) {
      await interaction.update({ content: `dungeon is full`, components: [], ephemeral: true })
      return
    }
    castCache[interaction.message.interaction.id] = this.spell.id

    var cult = server.Cults.userCult(interaction.member)
    let options = []
    let targetType = ""
    if (this.spell.type == CONJURE_FREEZE_SPELL) {
      targetType = "cultist"
      let users = cache.CultFreezeTargets[cult.id]
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
          label: member.displayName
        })
      }
    } else {
      targetType = "cult"
      for (const _cult of server.Cults.values()) {
        if (this.spell.type == CONJURE_ALLY_SPELL) {
          if (_cult.id != cult.id) {
            continue
          }
        } else if (_cult.id == cult.id) {
          continue
        }
        options.push({
          value: _cult.id,
          emoji: _cult.emojiId ? { id: _cult.emojiId } : { name: _cult.emoji },
          label: _cult.getName(server)
        })
      }
    }
    const row = new MessageActionRow()
      .addComponents(
        new MessageSelectMenu()
          .setCustomId('cast_select_to')
          .setPlaceholder('target ' + targetType)
          .addOptions(options)
      );
    await interaction.update({ content: `${this.spell.name} selected! select the ${targetType} you want to target...`, components: [row], ephemeral: true })
  }

  async selectTo(server, interaction) {
    if (interaction.values.length != 1) {
      await interaction.update({ content: 'cannot select multiple values', components: [] })
      return
    }
    var target = ""
    if (this.spell.type == CONJURE_FREEZE_SPELL) {
      var member = server.getMember(interaction.values[0])
      if (!member) {
        await interaction.update({ content: `error: couldn't find cultist | talk to @hypervisor`, components: [], ephemeral: true })
        return
      }
      target = `${member}`
    } else {
      var cult = server.Cults.get(interaction.values[0])
      if (!cult) {
        await interaction.update({ content: `error: couldn't find cult | talk to @hypervisor`, components: [], ephemeral: true })
        return
      }
      target = cult.getName(server)
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

    await interaction.update({ content: `cast ${this.spell.name} on ${target}`, components: [row], ephemeral: true })
  }

  async commit(server, interaction, castToCache) {
    await interaction.deferReply({ ephemeral: true })
    let target = castToCache[interaction.message.interaction.id]
    if (!target) {
      console.log("no target found")
      interaction.editReply({ content: 'no spell target found, talk to @hypervisor', components: [], ephemeral: true })
      return
    }
    console.log("target:", target)

    var creature
    if (this.spell.type == CONJURE_FREEZE_SPELL) {
      var member = server.getMember(target)
      if (!member) {
        await interaction.editReply({ content: `error: couldn't find cultist | talk to @hypervisor`, components: [], ephemeral: true })
        return
      }
      creature = await creatures.conjureFreezer(server, this.spell.power, member.id)
      cache.updateFreezeTargets()
    } else {
      var cult = server.Cults.get(target)
      if (!cult) {
        await interaction.editReply({ content: `error: couldn't find cult | talk to @hypervisor`, components: [], ephemeral: true })
        return
      }
      switch (this.spell.type) {
        case CONJURE_ENEMY_SPELL:
          creature = await creatures.conjureEnemy(server, this.spell.power, cult.id)
          break
        case CONJURE_ALLY_SPELL:
          creature = await creatures.conjureAlly(server, this.spell.power, cult.id)
          break
      }
    }
    if (!creature) {
      await interaction.editReply({ content: `error: failed to create creature | talk to @hypervisor`, components: [], ephemeral: true })
      return
    }


    try {
      await server.db.collection("events").insertOne({
        "metadata": { "user": interaction.member.id, "spell": this.spell, "creature": creature.id, "target": creature.target },
        "timestamp": new Date(),
        "spell_type": this.spell.type,
        "event": "cast"
      })
    } catch (error) {
      console.log("insert event error:", error)
      return
    }

    try {
      interaction.editReply({ content: `${creature.name} was summoned! see <#${creature.channelId}>`, components: [], ephemeral: true })
    } catch (error) {
      console.log("castConfirm interaction.reply error:", error)
    }
    // delete spell
    await server.db.collection("items").remove({ id: this.spell.id })

    if (this.spell.type == CONJURE_FREEZE_SPELL) {
      let member = server.getMember(creature.target.id)
      if (!member) {
        return
      }
      var cult = server.Cults.userCult(member)
      adventure.log(server, `${interaction.member} cast ${this.spell.name}, summoning ${creature.name} abducting ${member} of ${cult.getName(server)} (health: ${creature.healthRemaining})`)
      var enemyCult = server.Cults.userCult(interaction.member)
      var channel = await cult.channel(server)
      // channel.send(`<@&${cult.roleId}> ${member} has been abducted by ${interaction.member} of ${enemyCult.getName(server)}'s ${creature.name}! cast attack spells to break the chains <#${creature.channelId}> (health: ${creature.healthRemaining})`)
      channel.send(`${member} has been abducted by ${interaction.member} of ${enemyCult.getName(server)}'s ${creature.name}! cast attack spells to break the chains <#${creature.channelId}> (health: ${creature.healthRemaining})`)
    } else {
      var cult = server.Cults.get(target)
      let cultName = cult.getName(server)
      adventure.log(server, `${interaction.member} cast ${this.spell.name}, summoning  <#${creature.channelId}> ${creature.type == ALLY_TYPE ? "aiding" : "attacking"} ${cultName} (strength: ${creature.strength} health: ${creature.healthRemaining})`)

      // Send cult channel messages
      /*
      if (creature.type == ALLY_TYPE) {
        for (const _cult of server.Cults.values()) {
          if (_cult.id != cult.id) {
            let channel = await _cult.channel(server)
            await channel.send(`<@&${_cult.roleId}> ${interaction.member} summoned <#${creature.channelId}> to aid ${cultName}! cast attack spells to vanquish <#${creature.channelId}> and prevent ${cultName} from gaining points (+${creature.strength}𐂥/${creature.attackPeriod / 60 / 1000}m)`)
          }
        }
      } else if (creature.type == ENEMY_TYPE) {
        var channel = await cult.channel(server)
        await channel.send(`<@&${cult.roleId}> ${interaction.member} summoned <#${creature.channelId}> to attack you! cast attack spells to vanquish <#${creature.channelId}> (-${creature.strength}𐂥 /${creature.attackPeriod / 60 / 1000}m)`)
      }
      */
    }
  }
}

var conjuringEnemySpellCreator = new SpellGenerator(
  CONJURE_ENEMY_SPELL,
  ["Summoning"],
  ["Eye"],
  ["Corrupted"],
  ["of Oblivion"],
  gods,
)

var conjuringAllySpellCreator = new SpellGenerator(
  CONJURE_ALLY_SPELL,
  ["Summoning"],
  ["Shard"],
  ["Celestial"],
  ["of Vitality"],
  gods,
)

var conjuringFreezeSpellCreator = new SpellGenerator(
  CONJURE_FREEZE_SPELL,
  ["Summoning"],
  ["Ring"],
  ["Corrupted"],
  ["of Silence"],
  gods,
)

exports.summon = {
  spellType: SummoningSpell,
  enemyGenerator: conjuringEnemySpellCreator,
  allyGenerator: conjuringAllySpellCreator,
  freezeGenerator: conjuringFreezeSpellCreator
}