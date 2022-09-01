const { client } = require('./client/client')
const { batch } = require('./game/batch')
const { server } = require('./server')
const Database = require("@replit/database");
const { MongoClient } = require('mongodb')

const { creatures } = require('./spells/creatures')

const dotenv = require('dotenv')
dotenv.config()

console.log("db key:", process.env.REPLIT_DB_URL)
const database = new Database(process.env.REPLIT_DB_URL)
server.setDatabase(database)

let mongo = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
server.setDB(mongo.db("general"))

async function cleanupChannel(channelId, afterMessage){
  let channel = server.getChannel(channelId)
  console.log("channel:", channel)
  let fetched;
  do {
    fetched = await channel.messages.fetch({
      limit: 99,
      after: afterMessage
    })
    console.log("deleting...")
    await channel.bulkDelete(fetched, true)
  }
  while(fetched.size >= 2)
}

var loggedIn = false
client.once('ready', async () => {
	console.log('Ready!');
  loggedIn = true
  mongo.connect(async err => {
    if(err){
      console.log("mgo connect err:", err)
    }
    await cleanupChannel('1012894283499569203', '1012903031441993748')
  })
});

console.log("logging in")
client.login(process.env.TOKEN);
