// async function seedCoins(){
//   await server.db.collection("events").remove({},{$multi: true})
//   const channel = client.channels.cache.get(server.AltarChannelId);
//   let messages = await channel.messages.fetch({ limit: 100, after: '986495194755121162'})
//   messages = [...messages.values()] 
//   // 986595435714080778, 986595436871680000
//   messages = messages.filter(a => a.id != "986595435714080778" && a.id != "986595436871680000")
//   for(var i = 0; i < messages.length; i++){
//     let message = messages[i]
//     await server.db.collection("users").updateOne({ "discord.userid": message.author.id }, {$set:{points: 0, coins:0}})
//     let dbUser = await server.db.collection("users").findOne({ "discord.userid": message.author.id })
//     if(dbUser){
//       // console.log("would handle for user:", message.author.username)
//       points.handleChant(server, dbUser)
//     } else {
//       console.log("user not found:", message.author.id)
//     }
//   }
// }



// async function initNumChants(server){
//   console.log("initializing num chants")
//   let users = await server.db.collection("users").find({'discord.userid':{$exists:true}})
//   //var users = await server.db.collection("users").find()
//   console.log(users)
//   await users.map(async user => {
//     if(!user.discord || !user.discord.userid || user.discord.userid == ''){
//       console.log('empty userid:', user)
//       return null
//     }
//     let _replitUser = await server.loadUser(user.discord.userid)
//     if(_replitUser){
//       console.log("num chants updating user:", user.discord.userid, "chants:", _replitUser.numChants)
//     await server.db.collection("users").update({'discord.userid': user.discord.userid}, {$set: {num_chants: _replitUser.numChants}})
//     } else {
//       console.log("no replit user for user:", user)
//       return null
//     }
//   }).toArray()
//   console.log("done initializing num chants")
// }


async function retallyPoints(server){
    console.log("retallying points")
    let users = await server.db.collection("users").find({'discord.userid':{$exists:true}})
    //var users = await server.db.collection("users").find()
    console.log(users)
    await users.map(async user => {
      if(!user.discord || !user.discord.userid || user.discord.userid == ''){
        console.log('empty userid:', user)
        return null
      }
      let numRefs = user.referrals ? user.referrals.length : 0
      await server.db.collection("users").update({'discord.userid': user.discord.userid}, {$set: {points: user.num_chants + numRefs * 3 }})
    }).toArray()
    console.log("done initializing num chants")
  }