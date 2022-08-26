const { server } = require('../server')
const { StringMutex } = require('../utils/mutex')

const HomecomingActive = false
const HomecomingChannelId = '1004448290596724786'
const UserMutex = new StringMutex()
let numCults = server.Cults.values().length
const MAX_MEMBERS = Math.floor(280 / numCults)
const MAX_POINTS = Math.floor(1263 / numCults)

async function assignCult(userId, cult) {
  if (!cult) {
    console.log("no cult")
    return
  }
  console.log("getting user mutex")
  var release = await UserMutex.acquire(userId)
  console.log("got user mutex")
  try {
    let member = server.getMember(userId)
    var _cult = server.memberCult(member)
    if (_cult) {
      // remove them from old cult
      if (cult.id != _cult.id) {
        member.roles.remove(_cult.roleId)
        await server.db.collection("users").update({ 'discord.userid': userId }, { $set: { cult_id: '' } })
      } else {
        return true
      }
    }
    if (cult) {
      // assign user to cult
      console.log("adding role:", cult.roleId, "to user:", userId)
      await member.roles.add(cult.roleId)
      await server.db.collection("users").update({ 'discord.userid': userId }, { $set: { cult_id: cult.id } })
    }
  } finally {
    release()
  }
}

async function handleReaction(reaction, user) {
  if (!HomecomingActive) {
    return false
  }
  if (user.id == '974842656372953118') {
    return false
  }
  let targetMessage = await server.getCachedMessage(HomecomingChannelId, 'homecoming')
  if (!targetMessage) {
    return false
  }
  if (reaction.message.id != targetMessage.id) {
    return false
  }
  var release = await UserMutex.acquire(user.id)
  try {
    let member = server.getMember(user.id)
    var cult = server.memberCult(member)
    if (cult) {
      // already has cult
      if (cult.emoji != reaction.emoji.name) {
        // remove old cult
        member.roles.remove(cult.roleId)
        await server.db.collection("users").update({ 'discord.userid': user.id }, { $set: { cult_id: '' } })
        // reaction.users.remove(user.id)
        let _reaction = await targetMessage.reactions.resolve(cult.emoji)
        try {
          _reaction.users.remove(user.id)
        } catch (err) {
          console.log(err)
        }
      } else {
        return true
      }
    }
    for (const _cult of server.Cults.values()) {
      if (_cult.emoji == reaction.emoji.name) {
        cult = _cult
        break
      }
    }
    if (cult) {
      let metrics = await cult.getMetrics(server)
      let dbuser = await server.getUser(user.id)
      if (metrics.population >= MAX_MEMBERS || metrics.points + (dbuser ? dbuser.points : 0) >= MAX_POINTS) {
        reaction.users.remove(user.id)
        return true
      }
      // assign user to cult
      console.log("adding role:", cult.roleId, "to user:", user.id)
      await member.roles.add(cult.roleId)
      await server.db.collection("users").update({ 'discord.userid': user.id }, { $set: { cult_id: cult.id } })
      // updateMessage()
    }
  } finally {
    release()
  }
  return true

}

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array
}

async function updateMessage() {
  let txt = `AELIN, IT IS TIME TO BIND!

bind to the cult you consider home. bring your friends. try to keep the cults balanced, or the ancients may balance them for you...`
  let message = await server.updateCachedMessage(HomecomingChannelId, 'homecoming', txt)
  await message.reactions.removeAll()
  setTimeout(() => {
    for (const _cult of shuffleArray(server.Cults.values())) {
      message.react(_cult.emoji)
    }
  }, 1 * 1000)
}

async function init() {
  // updateMessage()
  setInterval(() => {
    updateMessage()
  }, 10 * 60 * 1000)
  if (await server.getCachedMessage(HomecomingChannelId, 'homecoming')) {
    return
  }
  updateMessage()
}


exports.homecoming = {
  init: init,
  addReaction: handleReaction,
  updateMessage: updateMessage,
  assignCult: assignCult
}