const { getStats } = require('./stats')

// function getMessage(server) {
//   let cults = server.Cults.values()
//   return `If you enchanted your wallet at https://spells.quest you have 1 key to mint a spell on Conjuring day. \nNow...\n



// .                                 º                                            .                 ․                   ․                                 ․      º               \n     ․    ∴     ˙  ⸱ ۛۛۛ      . º       ⦙࣪  ․⸳˙    ᩿     ⸱⸳․ ۛۛۛ           ᩿       ․  ˙  ․⸳       ˙  ⸱           .․ ⦙       ∴    ⸳       ᩿   ․            ᩿      ∴\nPicۛۛk a cult, and chooseۛۛۛ it carefully. Once aۛۛ cult is clickeۛۛۛd the bindingۛۛۛ ritual is compۛۛۛlete and eۛۛۛteۛۛۛrnۛۛal...\n                                            ˙          ․                    ˙                          ˙                                                                 ˙     \n                                                                                                                  \`  \n${cults[0].emoji}  ${cults[0].getName(server)}\n${cults[1].emoji}  ${cults[1].getName(server)}\n${cults[2].emoji}  ${cults[2].getName(server)}\n

// The cult with the most chants-per-member when the sand empties out will win a chest of minting keys and $DUST, raffled to its members. **This means the most zealous cult (not the largest) will win in the eyes of the ancients  <:magic:975922950551244871>**\n

// ⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫\n⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬`
// }

async function getMessage(server) {
  let cultStats = await getStats()
  for(const stats of cultStats) {
    let cult = server.Cults.get(stats.id)
    cult.stats = stats
  }
  let cults = server.Cults.values()
  console.log("cults:", cults)
  cults.sort((a,b)=>{
    if (a.stats.population < b.stats.population){
      return -1
    }
    return 1
  })
  return `If you enchanted your wallet at https://spells.quest you have 1 key to mint a spell on Conjuring day. \nNow...\n

.                                 º                                            .                 ․                   ․                                 ․      º               \n     ․    ∴     ˙  ⸱ ۛۛۛ      . º       ⦙࣪  ․⸳˙    ᩿     ⸱⸳․ ۛۛۛ           ᩿       ․  ˙  ․⸳       ˙  ⸱           .․ ⦙       ∴    ⸳       ᩿   ․            ᩿      ∴\nPicۛۛk a cult, and chooseۛۛۛ it carefully. Once aۛۛ cult is clickeۛۛۛd the bindingۛۛۛ ritual is compۛۛۛlete and eۛۛۛteۛۛۛrnۛۛal...\n                                            ˙          ․                    ˙                          ˙                                                                 ˙     \n                                                                                                                  \`  \n${cults[0].discordEmoji}  ${cults[0].getName(server)}\n${cults[1].discordEmoji}  ${cults[1].getName(server)}\n${cults[2].discordEmoji}  ${cults[2].getName(server)}\n

The cult with the most chants-per-member when the sand empties out will win a chest of minting keys and $DUST, raffled to its members. **This means the most zealous cult (not the largest) will win in the eyes of the ancients  <:magic:975922950551244871>** and the smaller the cult the fewer members to split your rewards with.

The first 60 members of each cult are also guaranteed a minting key.

⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫\n⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨫⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬⨬`
}

async function updateMessage(server) {
  let _channelId = server.BeginChannelId
  // let _channelId = "973760022427361322" // mod only channel
  let beginMessageId = await server.database.get(`beginMsg:${_channelId}`, {raw: false})
  let channel = server.client.channels.cache.get(_channelId)
  if(beginMessageId){
    let msg = await channel.messages.fetch(beginMessageId)
    if(msg) {
      msg.edit(await getMessage(server))
      return
    }
  }
  let message = await channel.send(await getMessage(server))
  await server.database.set(`beginMsg:${_channelId}`, message.id)
}

exports.begin = {
  updateMessage: updateMessage,
  getMessage: getMessage
}