const { server } = require('../server')
const { handleJoin } = require('./recruit')

// Cleanup cult roles. Ensures only one cult role per user, matching their cult_id.
// Also ensures that all users with a cult have the @cultist role.
async function cleanRoles(date = new Date(0)) {
  await server.loadDiscordUsers()
  let users = await server.db.collection("users").find({ 
    'discord.userid': { $exists: true, $ne: '', $nin: server.admins },
    'cult_id': { $exists: true, $ne: '' },
    'created_at': { $gt: date, $lt: new Date(new Date().getTime() - 60 * 1000) }
  })
  users = await users.toArray()
  console.log("num users:", users.length)

  for (const user of users) {
    if (!user.discord || !user.discord.userid || user.discord.userid == '') {
      console.log('empty userid:', user)
      continue
    }
    if (user.discord.userid == '365989466126549013') {
      console.log("found cloud caster")
    }
    let member = server.getMember(user.discord.userid)
    if (!member) {
      console.log("no member found for user:", user.discord.userid)
      continue
    }
    // user has cult role:
    let cult = server.Cults.get(user.cult_id)
    if (!cult) {
      console.log("user:", user.discord.name, user.discord.userid, "no cult assigned")
      continue
    }
    let hasOtherCultRole = false
    for (const [key, _cult] of server.Cults.entries()) {
      if (_cult.id != cult.id && member.roles.cache.has(_cult.roleId)) {
        console.log("user:", user.discord.name, user.discord.userid, "has wrong cult:", _cult.name)
        hasOtherCultRole = true
        member.roles.remove(_cult.roleId)
      }
    }
    if (!member.roles.cache.has(cult.roleId)) {
      console.log("user:", user.discord.name, user.discord.userid, "does not have cult role")
      if (!hasOtherCultRole){
        console.log("will handleJoin for user:", user.discord.name, user.discord.userid)
        if(true){
          await handleJoin(server, member)
        }
      }
      // member.roles.add(cult.roleId)
    }
    if (!member.roles.cache.has(server.Roles.Cultist)) {
      console.log("user:", user.discord.name, user.discord.userid, "does not have cultist role")
      // member.roles.add(server.Roles.Cultist)
    }
  }
}

exports.updater = {
  cleanRoles: cleanRoles
}