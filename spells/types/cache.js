const { server } = require('../../server')
const {
  ENEMY_TYPE,
  ALLY_TYPE,
  FREEZE_TYPE,
  BEES_SPELL,
  CONJURE_ENEMY_SPELL,
  CONJURE_ALLY_SPELL,
  CONJURE_FREEZE_SPELL,
} = require('../constants.js')

var CultFreezeTargets = {}
async function updateFreezeTargets() {
  console.log("updating freeze targets")
  for (const cult of server.Cults.values()) {
    try {
      let users = await server.db.collection("users").aggregate([
        {
          "$match": {
            "cult_id": { $ne: cult.id, $exists: true, $ne: '' },
            "discord.userid": { $exists: true, $ne: '', $nin: server.admins }
          }
        },
        {
          "$lookup": {
            from: 'creatures',
            let: { 'userid': '$discord.userid' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$target.id", "$$userid"] },
                      { $gt: ["$healthRemaining", 0] },
                      { $eq: ["$type", FREEZE_TYPE] }
                    ]
                  }
                }
              }
            ],
            as: 'chains'
          }
        },
        {
          "$match": {
            $or: [
              { chains: { $exists: false } },
              { chains: null },
              { chains: { $size: 0 } }
            ]
          }
        },
        {
          $sort: {
            points: -1,
            num_chants: -1
          }
        },
        {
          $limit: 100
        },
        {
          $sample: { size: 80 }
        }
      ]).toArray()
      
      let targets = []
      let _cooldown = new Date(new Date().getTime() - (12 * 60 * 60 * 1000))
      for(const user of users) {
        if(targets.length >= 25) {
          break
        }
        let c = await server.db.collection("events").count({
          event: 'chains_broken',
          timestamp: {$gt: _cooldown},
          'metadata.user': user.discord.userid
        })
        if(c == 0) {
          targets.push(user)
        }
      }
      
      // let users = await server.db.collection("users").aggregate([
      //   {
      //     "$match": {
      //       "cult_id": { $ne: cult.id, $exists: true, $ne: '' },
      //       "discord.userid": { $exists: true, $ne: '', $nin: server.admins }
      //     }
      //   },
      //   {
      //     "$lookup": {
      //       from: 'creatures',
      //       let: { 'userid': '$discord.userid' },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $and: [
      //                 { $eq: ["$target.id", "$$userid"] },
      //                 { $gt: ["$healthRemaining", 0] },
      //                 { $eq: ["$type", FREEZE_TYPE] }
      //               ]
      //             }
      //           }
      //         }
      //       ],
      //       as: 'chains'
      //     }
      //   },
      //   {
      //     "$match": {
      //       $or: [
      //         { chains: { $exists: false } },
      //         { chains: null },
      //         { chains: { $size: 0 } }
      //       ]
      //     }
      //   },
      //   {
      //     "$lookup": {
      //       from: 'events',
      //       let: { 'userid': '$discord.userid' },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $and: [
      //                 { $eq: ["$event", 'chains_broken'] },
      //                 { $gte: ["$timestamp", new Date(new Date().getTime() - (12 * 60 * 60 * 1000))] },
      //                 { $eq: ["$$userid", "$metadata.user"] }
      //               ]
      //             }
      //           }
      //         }
      //       ],
      //       as: 'recent_chains_broken'
      //     }
      //   },
      //   {
      //     "$match": {
      //       $or: [
      //         { recent_chains_broken: { $exists: false } },
      //         { recent_chains_broken: null },
      //         { recent_chains_broken: { $size: 0 } }
      //       ]
      //     }
      //   },
      //   {
      //     $sort: {
      //       points: -1,
      //       num_chants: -1
      //     }
      //   },
      //   {
      //     $limit: 40
      //   },
      //   {
      //     $sample: { size: 25 }
      //   }
      // ])
      // users = await users.toArray()
      CultFreezeTargets[cult.id] = targets
    } catch (e) {
      console.log("updateFreezeTargets for cult:", cult.name, "error:", e)
    }
  }
}

var CultBeesTargets = {}
async function updateBeesTargets() {
  for (const cult of server.Cults.values()) {
    try {
      let cooldown = new Date(new Date().getTime() - (36 * 60 * 60 * 1000))
      let users = await server.db.collection("users").aggregate([
        {
          "$match": {
            "cult_id": { $ne: cult.id, $exists: true, $ne: '' },
            "discord.userid": { $exists: true, $ne: '', $nin: server.admins }
          }
        },
        {
          "$lookup": {
            from: 'events',
            let: { 'userid': '$discord.userid' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$spell_type", BEES_SPELL] },
                      { $gte: ["$timestamp", cooldown] },
                      { $eq: ["$$userid", "$metadata.target.id"] }
                    ]
                  }
                }
              }
            ],
            as: 'bees'
          }
        },
        {
          "$match": {
            $or: [
              { bees: { $exists: false } },
              { bees: null },
              { bees: { $size: 0 } }
            ]
          }
        },
        {
          $sort: {
            points: -1,
            num_chants: -1
          }
        },
        {
          $limit: 45
        },
        {
          $sample: { size: 25 }
        }
      ])
      users = await users.toArray()
      CultBeesTargets[cult.id] = users
    } catch(e) {
      console.log("updateBeesTargets for cult:", cult.name, "error:", e)
    }
  }
}

async function update() {
  updateFreezeTargets()
  updateBeesTargets()
}

async function run() {
  update(server)
  setInterval(() => {
    update(server)
  }, 60 * 60 * 1000) // 1hr
}

exports.cache = {
  run: run,
  updateFreezeTargets: updateFreezeTargets,
  updateBeesTargets: updateBeesTargets,
  CultFreezeTargets: CultFreezeTargets,
  CultBeesTargets: CultBeesTargets
}