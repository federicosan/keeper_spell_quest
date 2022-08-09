const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js')
const { points } = require('./spells/points')
const {
  RECRUIT_CULT_POINTS,
  COINS_C,
  CHANT_POINTS,
  RECRUIT_POINTS
} = require('./spells/constants.js')


// explain 3 cults competing for spells
// chant in #visible-altar
// poll numChants -- once > 0, allow them to continue
async function start(server, interaction) {
  if (interaction.channel.id != '986712037633720390') {
    interaction.reply({ content: 'can\'t `/enter` here', ephemeral: true })
    return
  }
  let userCult = server.Cults.userCult(interaction.member)
  if (!userCult) {
    interaction.reply({ content: 'join a cult before entering (hint: look for links that look like https://spells/quest/?z=a42xU79Oip7X in <#979919655105875999>)', ephemeral: true })
    return
  }
  let cults = server.Cults.values()
  let embed = new MessageEmbed()
    .setTitle("aelїn 1/3")
    .setColor("#FFFFE0")
    .setDescription(`There exist 3 cults...
${cults[0].discordEmoji}  ${cults[0].getName(server)}\n${cults[1].discordEmoji}  ${cults[1].getName(server)}\n${cults[2].discordEmoji}  ${cults[2].getName(server)}

Each cult is competing in a game of zealotry and sabotage to win [*spells* <:magic:975922950551244871>](https://spells.quest).
🗝 **minting keys**  will be distributed to each cult in proportion to their score, and granted to members in a raffle  (lightly weighted by zealotry).

Actions you take earn points for your cult 𐂥.`)
    .addField('begin', `go to ${interaction.guild.channels.cache.get(server.AltarChannelId)} and chant: ${userCult.chant}`)
    .setFooter({ text: '​', iconURL: 'https://cdn.discordapp.com/emojis/975947945906176020.webp?size=96&quality=lossless' })
  await interaction.reply({ embeds: [embed], ephemeral: true })
  var intervalId = setInterval(async function() {
    var _user = server.loadUser(interaction.member.id)
    // _user.numChants > 0 check for backwards compatibility
    if (_user && (_user.hasChanted || (_user.numChants && _user.numChants > 0)) || interaction.member.id == server.ADMIN_ID) {
      const row = new MessageActionRow()
        .addComponents(
          new MessageButton()
            .setCustomId('enter_continue_1')
            .setLabel('continue')
            .setStyle('PRIMARY'),
          new MessageButton()
            .setCustomId('enter_cancel')
            .setLabel('exit')
            .setStyle('SECONDARY')
        );
      console.log("/enter editReply")
      await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true })
      clearInterval(intervalId)
    }
  }, 2 * 1000)
  setTimeout(() => { clearInterval(intervalId); }, 2 * 60 * 1000);
}

// chanted, you now have a point
async function continue_1(server, interaction) {
  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('enter_continue_2')
        .setLabel('/purse')
        .setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId('enter_cancel')
        .setLabel('exit')
        .setStyle('SECONDARY')
    );
  let embed = new MessageEmbed()
    .setTitle("you have chanted!")
    .setColor("#FFFFE0")
    .setDescription(`chants earn +${COINS_C * CHANT_POINTS} <:magic:975922950551244871> magic for you and +1 𐂥 cult points for your cult, and you can chant once each day (EST).\n\nyou need 𐂥 for your cult to win\nyou need <:magic:975922950551244871> to conjure spells <:rare_shard:982122044617551882>\n\nyou can call /purse to check how much <:magic:975922950551244871> you have.`)
    .setFooter({ text: '​', iconURL: 'https://cdn.discordapp.com/emojis/975977080699379712.webp?size=96&quality=lossless' })
  await interaction.update({ embeds: [embed], components: [row], ephemeral: true })
  // await interaction.update({content: 'you have chanted! chants earn +10 <:magic:975922950551244871> magic for you and +1 𐂥 cult points for your cult, and you can chant once each day (EST).\n\nyou need 𐂥 for your cult to win\nyou need <:magic:975922950551244871> to conjure spells <:rare_shard:982122044617551882>\n\nyou can call /purse to check how much <:magic:975922950551244871> you have.', embeds: [ ], components: [row], ephemeral:true})
}

// purse
async function continue_2(server, interaction) {
  let _stats = await points.getUserStats(server, interaction)
  let embed = new MessageEmbed()
    .setTitle("👝")
    .setColor("#FFFFE0")
    .setDescription(_stats)
    .setFooter({ text: '​', iconURL: 'https://cdn.discordapp.com/emojis/975977080699379712.webp?size=96&quality=lossless' })
  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('enter_continue_3')
        .setLabel('continue')
        .setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId('enter_cancel')
        .setLabel('exit')
        .setStyle('SECONDARY')
    );
  await interaction.update({ embeds: [embed], components: [row], ephemeral: true })
}

// recruiting + sabotage
async function continue_3(server, interaction) {
  let user = server.getDBUser(interaction.member.id)
  let zealousLink = "no link found, be sure to bind @ https://spells.quest/bind"
  if (user) {
    zealousLink = `https://spells.quest/?z=${user.referral_key}`
  }
  let userCult = server.Cults.userCult(interaction.member)
  let embed = new MessageEmbed()
    .setTitle("aelїn 2/3")
    .setColor("#FFFFE0")
    .setDescription(`${userCult.getName(server)} needs fresh blood...`)
    .addField('conversion', `converting new members to your cult using your **zealous link** earns you <:magic:975922950551244871> 30 magic and 𐂥 7 cult points. send it to friends and true believers to convert them to your cause!`)
    .addField('zealous link', zealousLink)
    .addField('sabotage', `you can also sabotage *other* cults by setting your zealous link to convert to a different cult. call \`/sabotage\` to change the cult you want to sabotage. you still get <:magic:975922950551244871> 30 and 𐂥 2, and the other cult's score will be dragged down by the unzealous cultist.`)
    // .addField('sabotage', `you can also sabotage *other* cults by setting your zealous link to convert to a different cult. call \`/sabotage\` to change the cult you want to sabotage.  unzealous recruits your Zealous Link and the incantation of the cult you want to sabotage - you still get <:magic:975922950551244871> 30 and 𐂥 2, and the other cult's score will be dragged down by the unzealous cultist.`)
    .addField('how sabotage?', `the score of each cult = points/(members ^ 1.333). good mindless zealots may be confused... but what this means is that adding members to another cult can hurt their score if those members prove unzealous (they don't chant / recruit). this is not essential to the game, but it's fun if played right.`)
    .setFooter({ text: '​', iconURL: 'https://cdn.discordapp.com/emojis/975947945906176020.webp?size=96&quality=lossless' })
  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('enter_continue_4')
        .setLabel('continue')
        .setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId('enter_cancel')
        .setLabel('exit')
        .setStyle('SECONDARY')
    );
  // await interaction.update({content:'​', embeds: [embed], components: [row], ephemeral:true})
  await interaction.update({ embeds: [embed], components: [row], ephemeral: true })
}

// conjuring + magic
async function continue_4(server, interaction) {
  let userCult = server.Cults.userCult(interaction.member)
  let embed = new MessageEmbed()
    .setTitle("aelїn 3/3")
    .setColor("#FFFFE0")
    .setDescription(`a game of on-server magic <:magic:975922950551244871>`)
    .addField('spells', `while the real spells have yet to be released on-chain, a game of on-server magic is brewing! soon you will be able to spend your magic <:magic:975922950551244871> to conjure spells that summon monsters, confuse your enemies, deal damage, steal points, and much more...\n\naelїn\n-<@&${server.ADMIN_ID}>\n\n\np.s. try \`/equip\``)
    .setFooter({ text: '​', iconURL: 'https://cdn.discordapp.com/emojis/975977080699379712.webp?size=96&quality=lossless' })
  // await interaction.update({content:'​', embeds: [embed], ephemeral:true})
  await interaction.update({ embeds: [embed], components: [], ephemeral: true })
}

async function cancel(server, interaction) {
  interaction.reply({ content: 'you have exited', ephemeral: true })
}

async function _continue(server, interaction, step) {
  switch (step) {
    case 1:
      continue_1(server, interaction)
      break
    case 2:
      continue_2(server, interaction)
      break
    case 3:
      continue_3(server, interaction)
      break
    case 4:
      continue_4(server, interaction)
      break
  }
}

exports.enter = {
  start: start,
  continue: _continue,
  cancel: cancel
}