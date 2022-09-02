class KeyValueStore {
  constructor(db) {
    this.db = db
  }
  async set(key, value){
    try{
      await this.db.collection("kv").updateOne({ key: key}, {$set:{value: value}}, {upsert: true})
    } catch(e) {
      console.log(e)
    }
  }
  
  async delete(key){
    try{
      await this.db.collection("kv").deleteOne({ key: key})
    } catch(e) {
      console.log(e)
    }
  }
  
  async get(key){
    try{
      let r = await this.db.collection("kv").findOne({ key: key})
      if(r){
        return r.value
      }
      return null
    } catch(e) {
      console.log(e)
      return null
    }
  }
  
  async increment(key, amount) {
    try{
      await this.db.collection("kv").updateOne({ key: key}, {$inc: {value: amount}}, {upsert: true})
    } catch(e) {
      console.log(e)
    }
  }
}

exports.KeyValueStore = KeyValueStore