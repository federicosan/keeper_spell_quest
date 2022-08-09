async function runBindingStatsUpdater(server){
  //updateAllCultBindingStats(server)
  var intervalId = setInterval(function() {
    updateAllCultBindingStats(server)
  }, 600000)
}

var lastBindingStats = {}

async function getAllCultsUnbound(server){
  var guild = server.client.guilds.cache.get(server.Id)
  let members = await guild.members.fetch()
  let cultUsersMsg = {}
  
  for(const cult of server.Cults.values()) {
    cultUsersMsg[cult.id] = `<@&${cult.roleId}> unbound members:\n\n`
  }
  members.each(async (member) => {
    let cult = server.Cults.userCult(member)
    if(!cult){
      return
    }
    let user = await server.db.collection("users").findOne({ "discord.userid": member.id })
    if(!user){
      console.log(`<@&${cult.roleId}> ${member}`)
      cultUsersMsg[cult.id] += `${member} `
    }
  })
  console.log(cultUsersMsg)
}

async function updateAllCultBindingStats(server){
  let cultStats = await getStats()
  for(const stats of cultStats) {
    let cult = server.Cults.get(stats.id)
    cult.stats = stats
    cult.bindings = await server.db.collection("users").count({cult_id: cult.id})
    cult.bindingScore = cult.bindings/cult.stats.population
  }
  for(const cult of server.Cults.values()) {
    if(cult.id in lastBindingStats){
      if (lastBindingStats[cult.id] == cult.bindingScore) {
        // console.log("cult", cult.name, "binding score unchanged")
        continue
      }
    }
    lastBindingStats[cult.id] = cult.bindingScore
    let msg = `${cult.emoji} `
    let steps = Math.round((cult.bindingScore*100).toFixed(0) / 10)
    console.log("cult:", cult, "steps:", steps)
    for(var i = 0; i < 5; i++) {
      if(steps <= 0) {
        msg += "░"
      } else if (steps == 1) {
        msg += "▒"
        steps -= 1
      } else {
        msg += "█"
        steps -= 2
      }
    }
    msg += ` ${cult.bindings}/${cult.stats.population}`
    let channel = await server.client.channels.cache.get(cult.bindingChannel)
    console.log("channelid:", cult.bindingChannel, "name:", msg)
    try{
      await channel.setName(msg)
    } catch(error) {
      console.log("setName error:", error)
      return false
    }
  }
}