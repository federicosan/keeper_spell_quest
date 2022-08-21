const { getAllPastChantsCount } = require('../utils/user')
class User {
  constructor(id, lastChant) {
    this.id = id
    this.lastChant = lastChant
    this.hasChanted = false
  }
}

class Cultist {
  constructor(dbuser){
    Object.assign(this, dbuser)
    this.id = this.discord.userid
  }
  
  async lastChantedAt(server) {
    try {
      let lastChant = await server.db.collection("events").find({'metadata.user':this.id, event: 'chant'}).sort({'metadata.timestamp': -1}).limit(1).toArray()[0]
      return lastChant.timestamp
    } catch(error) {
      console.log("lastChantedAt error:", error)
      return 0
    }
  }
  
  async hasChanted() {
    return getAllPastChantsCount(this) > 0
  }
}
  
exports.User = User
exports.Cultist = Cultist