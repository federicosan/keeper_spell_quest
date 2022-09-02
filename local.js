const { clients, KeeperClient, TRIGGER_MODE } = require('./client/client')
const { batch } = require('./game/batch')
const { server } = require('./server')
const Database = require("@replit/database");
const { MongoClient } = require('mongodb')

const { creatures } = require('./spells/creatures')
const { updater } = require('./game/updater');
const dotenv = require('dotenv')
dotenv.config()

console.log("db key:", process.env.REPLIT_DB_URL)
const database = new Database(process.env.REPLIT_DB_URL)
server.setDatabase(database)

let mongo = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
server.setDB(mongo.db("general"))

const allReadyCallback = async () => {
  await server.Cults.init(server, readOnly = false)
  // await batch.cleanupChannelMessages('1012894283499569203', '1012903031441993748')
  await batch.cleanupChannelMessages(server.channels.EnterChannelId, '1010303218678501468')
  await updater.cleanRoles()
}

clients.init( [
    new KeeperClient(process.env.TOKEN_2, TRIGGER_MODE.none)
  ],
  allReadyCallback
)

console.log("connecting to mongo...")
mongo.connect(async err => {
  if(err){
    console.log("mgo connect err:", err)
    return
  }
  console.log("connected to mongo")
  // server.setClient(clients.getAll()[1].client)
  clients.start()
})
