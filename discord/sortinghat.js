const { server } = require('../server')
const { StringMutex } = require('../utils/mutex')

const SortingHatChannelId = '1012894283499569203'
const UserMutex = new StringMutex()


async function addReaction(reaction, user) {
  if (server.isAdmin(user.id)) {
    return false
  }
  let targetMessage = await server.getCachedMessage(SortingHatChannelId, 'sortinghat')
  if (!targetMessage) {
    return false
  }
  if (reaction.message.id != targetMessage.id) {
    return false
  }
  
  var release = await UserMutex.acquire(user.id)
  try {
    let cultist = await server.getUser(user.id)
    if(!cultist){
      let embed = new MessageEmbed()
        .setTitle(`${user} you must bind before playing <:magic:975922950551244871>`)
        .setColor("#FFFFE0")
        .setURL('https://spells.quest/bind')
        .setDescription(`you must [**bind**](https://spells.quest/bind) to join a cult`)
        .addField('binding', 'one click auth with discord so @keeper can connect your wallet to your profile. [go here](https://spells.quest/bind) and click the 🗡')
        .setFooter({ text: '​', iconURL: 'https://cdn.discordapp.com/emojis/975977080699379712.webp?size=96&quality=lossless' })
      let response = await targetMessage.reply({ embeds: [embed] }).catch(console.error)
      setTimeout( async () => {
        try {
          await response.delete()
        } catch(err) {
          console.log("response delete error:", err)
        }
      }, 120 * 1000)
      return true
    }
    let member = server.getMember(user.id)
    var cult = server.memberCult(member)
    if (cult) {
      // already has cult
      try {
        reaction.users.remove(user.id)
      } catch (err) {
        console.log(err)
      }
      return true
    }
    
    if(Math.random() < 0.5) {
      let idx = Math.floor(Math.random() * server.Cults.values().length)
      cult = server.Cults.values()[idx]
    } else {
      let minPoints = Number.MAX_SAFE_INTEGER
      for (const _cult of server.Cults.values()) {
        let score = await _cult.getScore(server)
        if(score < minPoints){
          cult = _cult
        }
      }
    }
    if (cult) {
      // assign user to cult
      console.log("adding role:", cult.roleId, "to user:", user.id)
      await server.db.collection("users").update({ 'discord.userid': user.id }, { $set: { cult_id: cult.id } })
      await member.roles.add(cult.roleId)
    }
  } finally {
    release()
  }
  return true

}

async function updateMessage() {
  let txt = `**enter the sorting hat**
  
there are 3 ways to join a cult:

1. **react with 🪑 and the sorting hat will assign you a cult**
2. ask a friend to invite you to their cult
3. go to <#979919655105875999> and use someone's zealous link`
  let message = await server.updateCachedMessage(SortingHatChannelId, 'sortinghat', txt)
  await message.reactions.removeAll()
  setTimeout(() => {
    message.react('🪑')
  }, 1 * 1000)
}

async function init() {
  // updateMessage()
  // setInterval(() => {
  //   updateMessage()
  // }, 10 * 60 * 1000)
  updateMessage()
  if (await server.getCachedMessage(SortingHatChannelId, 'sortinghat')) {
    return
  }
  updateMessage()
}

exports.sortinghat = {
  init: init,
  addReaction: addReaction
}