const { interactionHandler } = require('./client/interaction')
const { client, setClientTriggers } = require('./client/client')
const { stats } = require('./game/stats')
const { vote } = require('./game/vote')
const { runReferralsCounter, runPurgatory } = require('./game/recruit')
const { batch } = require('./game/batch')
const { server } = require('./server')
const Database = require("@replit/database");
const { MongoClient } = require('mongodb')
const express = require('express')

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
const { extensions } = require('./extensions/extensions')

const uri = process.env.MONGO_URI

let mongo = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })
server.setDatabase(database)
server.setDB(mongo.db("general"))

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

setClientTriggers()
var loggedIn = false

client.once('ready', async () => {
  console.log('Ready!');
  loggedIn = true
  await server.loadDiscordUsers()
  await vote.init(server)
  await server.Cults.loadEmojis(server.kvstore)
  await stats.init()
  runPurgatory(server)

  clock.run()
  initMessageCache()
  for (const cult of server.Cults.values()) {
    console.log("cult:", cult.name, "num-members:", cult.countMembers(server))
  }
  
  // await batch.migrate()
  interactionHandler.init(server)
  await spells_game.init(server)
  await homecoming.init()
  await extensions.init()
  runReferralsCounter(server)
  spells_game.run(server)
  extensions.run()
});

console.log("connecting to mongo...")
mongo.connect(async err => {
  if (err) {
    console.log("mgo connect err:", err)
  }
  console.log("logging in")
  client.login(process.env.TOKEN)
  return
})


// handle gcloud health check
const app = express()
const port = 8080

app.get('/', (req, res) => {
  res.send('alive')
})

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})

setTimeout(() => {
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


