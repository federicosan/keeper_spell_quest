const { interactionHandler } = require('./interaction')
const { client, setClientTriggers } = require('./client/client')
const { stats } = require('./stats')
const { vote } = require('./vote')
const { handleJoin } = require('./recruit')
const { runReferralsCounter, runPurgatory } = require('./recruit')
const { batch } = require('./batch')
const { server } = require('./server')
const Database = require("@replit/database");
const { MongoClient } = require('mongodb')
const database = new Database()
const dotenv = require('dotenv')
dotenv.config()

console.log("database:", database)
const Web3 = require('web3');
const web3 = new Web3(process.env.WEB3_URI)

var exec = require('child_process').exec
const { spells_game } = require('./spells/controller')
const { clock } = require('./game/clock')
const { homecoming } = require('./game/homecoming')
// const { liveTesting } = require('./tests/live');
// const { Stats } = require('fs');

const uri = process.env.MONGO_URI

let mongo = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })
server.setDatabase(database)
server.db = mongo.db("general")



async function initMessageCache() {
  var guild = await client.guilds.cache.get(server.Id)
  var cultChannels = server.Cults.channelIds()
  try {
    let channels = guild.channels.cache
    for (const channel of channels.values()) {
      if (channel.type != 'GUILD_TEXT') {
        continue
      }
      if (channel.parentId == server.channels.DungeonSectionId) {
        continue
      }
      let _lastMsg = 0;
      while (true) {
        let messages = await channel.messages.fetch({
          limit: 99,
          after: _lastMsg
        })
        messages = [...messages.values()]
        if (messages.length == 0) {
          break;
        }
        if (!cultChannels.includes(channel.id)) {
          break
        }
        _lastMsg = messages[0].id
      }
      console.log("loaded channel:", channel.name)
    }
  } catch (error) {
    console.log(error)
  }
}

// async function fixBees() {
//   console.log("fix bees")
//   let events = await server.db.collection("events").find({ spell_type: 'bees_spell' })
//   console.log("fix bees events:", events)
//   await events.map(async event => {
//     let durationHrs = Math.max(6, event.metadata.spell.power * 16 + Math.random() * event.metadata.spell.power * 4 + Math.random() * 2)
//     let endTime = new Date(event.timestamp.getTime() + Math.round(durationHrs * 60 * 60 * 1000))
//     await server.db.collection("events").update({ 'metadata.end': event.metadata.end }, {
//       $set: {
//         'metadata.end': endTime
//       }
//     })
//     console.log("fixed 1 bees spell event")
//   }).toArray()
// }

setClientTriggers()
var loggedIn = false

client.once('ready', async () => {
  console.log('Ready!');
  loggedIn = true
  await server.loadDiscordUsers()
  await vote.init(server)
  await server.Cults.loadEmojis(database)
  await stats.init()
  runPurgatory(server)
  
  clock.run()
  initMessageCache()
  for (const cult of server.Cults.values()) {
    console.log("cult:", cult.name, "num-members:", cult.countMembers(server))
  }
  // db required vvv
  // await batch.prepForHomecoming()
  interactionHandler.init(server)
  await spells_game.init(server)
  await homecoming.init()
  runReferralsCounter(server)
  spells_game.run(server)
});

console.log("connecting to mongo...")
mongo.connect(async err => {
  if (err) {
    console.log("mgo connect err:", err)
  }
  console.log("logging in") 
  client.login(process.env.TOKEN);
  return;
})

// throw new Error("no")

// var loggedIn = false
// client.once('ready', async () => {
//   console.log('Ready!');
//   loggedIn = true
//   await vote.init(server)
//   await server.Cults.loadEmojis(database)
//   await server.loadDiscordUsers()
//   await stats.init()
//   // runPurgatory(server)
//   mongo.connect(async err => {
//     if (err) {
//       console.log("mgo connect err:", err)
//     }
//     await batch.migrate()
//     // let newMembers = [
//     //   // '247400794561708032',
//     //   '235834481020370944',
//     //   '774710241182351420',
//     //   '915268831100932096',
//     //   '586183501389365278',
//     //   '287405460263403523'
//     // ]
//     // for(const memid of newMembers){
//     //   let member = server.getMember(memid)
//     //   if(!member){
//     //     console.log("no member")
//     //     continue
//     //   }
//     //   handleJoin(server, member) 
//     // }
//     // batch.resetCultScores()
//     // batch.migrate()
//     // batch.resetChanting()
//     // interactionHandler.init(server)
//     // await spells_game.init(server)
//     // runReferralsCounter(server)
//     // spells_game.run(server)
//     return;
//   })
//   // clock.run()
//   initMessageCache()
//   for (const cult of server.Cults.values()) {
//     console.log("cult:", cult.name, "num-members:", cult.countMembers(server))
//   }
// });

setTimeout(() => {
  //throw new Error("testing")
  if (!loggedIn) {
    exec("kill 1", function(error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
      }
    })
  }
}, 10000)


