const { Permissions } = require('discord.js');
const { SetChannelPermissions, CULTIST_READ_ONLY, CULTIST_READ_WRITE } = require('./permissions')

function _cultDungeonChannelName(cult) {
  return `⎼⎼⎼ ${cult.emoji} dunge❍n ⎼⎼⎼`
}

async function upsertCultDungeon(server, cult, readOnly = false) {
  console.log("upserting dungeon for cult", cult.name)
  let dungeonId = await server.kvstore.get(`cult:${cult.id}:dungeon`)
  let dungeon = dungeonId ? await server.getChannel(dungeonId) : null
  let name = _cultDungeonChannelName(cult)
  if(!dungeon) {
    if(readOnly) {
      return
    }
    var guild = server.client.guilds.cache.get(server.Id)
    dungeon = await guild.channels.create(name, {
      type: 4, // GUILD_CATEGORY
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [Permissions.FLAGS.VIEW_CHANNEL],
        }
      ]
    })
    await SetChannelPermissions(server, dungeon, CULTIST_READ_ONLY)
  } else if (dungeon.name != name && !readOnly) {
    await dungeon.setName(name)
  }
  if(dungeon){
    if(!dungeonId || dungeon.id != dungeonId) {
      await server.kvstore.set(`cult:${cult.id}:dungeon`, dungeon.id)
    }
    cult.channels.DungeonSectionId = dungeon.id
  }
}

async function loadCultDungeon(server, cult) {
  await upsertCultDungeon(server, cult, true)
}

async function upsertCultChannels(server, cult, readOnly = false) {
  // server.channels.CultsSectionId
  // TODO: 
  // - cult channel
  // - proposals channel
  // - chest channel (read only, but allow reactions)
  // - fragments channel (tbd)
}

async function loadCultChannels(server, cult) {
  upsertCultChannels(server, cult, true)
}

exports.channels = {
  upsertCultDungeon: upsertCultDungeon,
  loadCultDungeon: loadCultDungeon,
  upsertCultChannels: upsertCultChannels,
  loadCultChannels: loadCultChannels,
}