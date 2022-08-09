const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js')
const { spells } = require('./spells')
var spellCache = {}

async function _cleanup(server, interaction){
  delete spellCache[interaction.message.interaction.id]
}

async function cancel(server, interaction){
  await _cleanup(server, interaction)
  interaction.update({content: 'drop canceled', components: [], ephemeral: true})
}

async function start(server, interaction){
  let items = await server.db.collection("items").find({
    owner: interaction.member.id
  })
  console.log("items:", items)
  let options = await items.map(item => {
    return {
      value: item.id,
      // emoji: { id: ITEM_PARAMS[item.name].emoji.id},
      label: item.name,
      description: spells.SpellDescriptions[item.type]
    }
  }).toArray()
  if(options.length == 0){
    await interaction.reply({content: "no spells in your inventory, use /conjure to create spells", ephemeral: true})
    return
  }
  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
        .setCustomId('drop_select')
        .setPlaceholder('inventory')
        .addOptions(options)
    );
  await interaction.reply({ content: 'select spell to drop', components: [row], ephemeral:true })
}

async function select(server, interaction){
  if (interaction.values.length != 1){
    await interaction.update({ content: 'cannot select multiple values', components: [], ephemeral:true })
    return
  }
  var item;
  try {
    item = await server.db.collection("items").findOne({
      id: interaction.values[0]
    })
  } catch(error) {
    console.log("error:", error)
    await interaction.update({ content: `error: ${error} | talk to @hypervisor`, components: [], ephemeral:true })
    return
  }
  spellCache[interaction.message.interaction.id] = item.id
  const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId('drop_confirm')
          .setLabel('Drop')
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId('drop_cancel')
          .setLabel('Cancel')
          .setStyle('SECONDARY')
      );
    
    await interaction.update({ content: `drop ${item.name}?`, components: [row], ephemeral:true })
}

async function commit(server, interaction){
  // get spells, display as list
  let from = spellCache[interaction.message.interaction.id]
  console.log("from:", from)
  var item;
  try {
    item = await server.db.collection("items").findOne({
      id: from
    })
  } catch(error) {
    console.log("error:", error)
    await interaction.update({ content: `error: ${error} | talk to @hypervisor`, components: [], ephemeral:true })
    _cleanup(server, interaction)
    return
  }
  if(!item){
    await interaction.update({content: "error: retry, if this persists @hypervisor", components:[], ephemeral: true})
    _cleanup(server, interaction)
    return
  }
  await server.db.collection("items").remove({id: item.id})
  await interaction.update({ content: `${item.name} dropped!`, components: [], ephemeral:true })
  _cleanup(server, interaction)
}

exports.drop = {
  start: start,
  select: select,
  commit: commit,
  cancel: cancel
}
