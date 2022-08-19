const ACTIVE_STATE = "active"
const ARCHIVED_STATE = "archived"

class Proposal {
  constructor(effect, id, cult, data) {
    this.effect = effect
    this.id = id
    this.cult = cult.id
    this.ayes = []
    this.nays = []
    this.data = data
    this.state = ACTIVE_STATE
  }

  async save(server) {
    await server.database.set(`poposal:${this.id}`, JSON.stringify(this))
  }

  async delete(server) {
    await server.database.delete(`poposal:${this.id}`)
  }

  async _removeReaction(server, userId, emojiId) {
    let channel = server.client.channels.cache.get(this.cult)
    let message = await channel.messages.fetch(this.id)
    if (!message) {
      console.log("proposal message", this.id, "not found in channel:", this.cult)
      return
    }
    let reaction = await message.reactions.resolve(emojiId)
    reaction.users.remove(userId)
  }

  async add(server, userId, emoji) {
    if (emoji == server.Emojis.AYE) {
      await this.addAye(server, userId)
      return true
    } else if (emoji == server.Emojis.NAY) {
      await this.addNay(server, userId)
      return true
    }
    return false
  }

  async remove(server, userId, emoji) {
    if (emoji == server.Emojis.AYE) {
      await this.removeAye(server, userId)
      return true
    } else if (emoji == server.Emojis.NAY) {
      await this.removeNay(server, userId)
      return true
    }
    return false
  }

  async addAye(server, userId) {
    console.log("addAye - userId:", userId, "proposal:", this)
    let defer = () => { }
    if (this.nays.includes(userId)) {
      console.log("nays includes user:", userId, "removing...")
      defer = () => {
        this._removeReaction(server, userId, server.Emojis.NAY)
      }
      this.nays = this.nays.filter(function(user) {
        return user != userId;
      })
    }
    this.ayes.push(userId)
    console.log("post filter proposal:", this)
    await this.save(server)
    defer()
  }

  async removeAye(server, userId) {
    console.log("removeAye - userId:", userId, "proposal:", this)
    this.ayes = this.ayes.filter(function(user) {
      return user != userId;
    })
    console.log("post filter proposal:", this)
    await this.save(server)
  }

  async addNay(server, userId) {
    console.log("addNay - userId:", userId, "proposal:", this)
    let defer = () => { }
    if (this.ayes.includes(userId)) {
      console.log("ayes includes user:", userId, "removing...")
      defer = () => {
        this._removeReaction(server, userId, server.Emojis.AYE)
      }
      this.ayes = this.ayes.filter(function(user) {
        return user != userId;
      })
    }
    this.nays.push(userId)
    console.log("proposal:", this)
    await this.save(server)
    defer()
  }

  async removeNay(server, userId) {
    console.log("removeNay - userId:", userId, "proposal:", this)
    this.nays = this.nays.filter(function(user) {
      return user != userId;
    })
    console.log("post filter proposal:", this)
    await this.save(server)
  }

  getCult(server) {
    if (this.cult == server.TestCult.id) {
      return server.TestCult
    }
    return server.Cults.get(this.cult)
  }

  // Motion passes when ayes are leading 5:1 with at least 1/4th
  // of members responding, or when ayes pass 50% of members.
  async canCommit(server) {
    let cult = this.getCult(server)
    let numMembers = await cult.countMembers(server)
    console.log("num members:", numMembers)
    if (this.ayes.length / numMembers > 1 / 2) {
      return true
    } else if ((this.ayes.length + this.nays.length) / numMembers >= 1 / 6 && this.nays.length / this.ayes.length <= 0.2) {
      return true
    }
    return false
  }

  async commit(server) {
    console.log("commiting", this.effect, "data:", this.data)
    let cult = this.getCult(server)
    let role = cult.getRole(server)
    switch (this.effect) {
      case "colorize":
        try {
          await role.edit({
            color: this.data['color']
          })
        } catch (error) {
          console.log(error)
          server.client.catch(error)
          return false
        }
        return true
      case "rename":
        // rename cult
        await cult.rename(server, this.data['name'].toLowerCase(), this.data['emoji'])
        console.log("done renaming cult")
        return true
      // case "change emoji":
      //   await cult.rename(server, this.data['name'].toLowerCase(), this.data['emoji'])
      //   console.log("done renaming cult")
      //   return true
    }
    return false
  }
}

let activeProposals = []

async function _loadProposals(server) {
  var proposals = await server.database.get(`poposals`, { raw: false })
  console.log("loaded proposals:", proposals)
  if (proposals == null) {
    proposals = []
  } else {
    proposals = JSON.parse(proposals)
  }
  return proposals
}

async function init(server) {
  activeProposals = await _loadProposals(server)
}

var GraphemeBreaker = require('grapheme-breaker')

function isOneEmoji(input) {
  console.log("emoji:", input, "emoji length:", input.length)
  return GraphemeBreaker.break(input).length == 1
}

async function proposeName(server, message, cult, proposal) {
  // parse new name
  let lines = message.content.split(/\r?\n/)
  for (var line of lines) {
    line = line.toLowerCase()
    if (line.toLowerCase().startsWith("name:")) {
      proposal.data['name'] = line.replace("name:", "").trim()
    }
    if (line.toLowerCase().startsWith("emoji:")) {
      proposal.data['emoji'] = line.replace("emoji:", "").trim()
      if (!isOneEmoji(proposal.data['emoji'])) {
        console.log("emoji invalid:", proposal.data['emoji'])
        message.channel.send("emoji must be one character long, server reactions are sadly not supported by the gods of the discord channel name,,,")
        return
      }
    }
  }
  await commitProposal(server, message, cult, proposal)
}

async function proposeColor(server, message, cult, proposal) {
  // parse new name
  let lines = message.content.split(/\r?\n/)
  console.log("lines:", lines)
  for (const line of lines) {
    if (line.toLowerCase().startsWith("color:")) {
      console.log("line starts with color:", line)
      console.log("replaced value:", line.replace("color:", "").trim())
      proposal.data['color'] = line.replace("color:", "").trim()
      console.log("color:", proposal.data['color'])
      var reg = /^#([0-9a-fA-F]{3}){1,2}$/i
      if (!reg.test(proposal.data['color'])) {
        message.reply("curses!!! what kind of color is this??? it looks nothing like my favorite color #ffffe0. make it look more like that,,,")
        return
      }
    }
  }
  await commitProposal(server, message, cult, proposal)
}

async function commitProposal(server, message, cult, proposal) {
  console.log("committing:", proposal)
  await server.database.set(`poposal:${proposal.id}`, JSON.stringify(proposal))
  let proposals = await _loadProposals(server)
  if (!proposals.includes(proposal.id)) {
    proposals.push(proposal.id)
    await server.database.set(`poposals`, JSON.stringify(proposals))
    message.react(server.Emojis.AYE)
    message.react(server.Emojis.NAY)
    //message.reply(`<@&${cult.roleId}> new motion for voting`)
  }
  activeProposals = proposals
}

async function propose(server, message) {
  if (activeProposals.length > 20) {
    message.reply("too many active proposals")
    return
  }
  console.log("propose called message:", message)
  let cult = server.Cults.get(message.channel.id)
  if (cult == null) {
    message.channel.send("not a cult channel")
    return
  }
  if (cult.proposalsChannel != message.channel.id) {
    message.reply(`ah <@${message.author.id}>, a cultist utters such things in #${server.getChannelName(cult.proposalsChannel)}`)
    return
  }

  let proposal = await server.database.get(`poposal:${message.id}`, { raw: false })
  if (proposal != null) {
    console.log("already proposed")
    return
  }

  let effect = "rename"
  let lines = message.content.split(/\r?\n/)
  for (const line of lines) {
    if (line.toLowerCase().startsWith("effect:")) {
      effect = line.toLowerCase().replace("effect:", "").trim()
    }
  }
  proposal = new Proposal(effect, message.id, cult, {})
  switch (effect) {
    case "rename":
      proposeName(server, message, cult, proposal)
      return
    case "colorize":
      proposeColor(server, message, cult, proposal)
      return
  }
  message.reply("the ancients do not recognize this magic. be sure to set effect: [rename,colorize]")
}

async function handleMsg(server, message) {
  if (message.content.toLowerCase().startsWith("proposal\n")) {
    propose(server, message)
    return true
  } else if (server.Cults.proposalChannelIds().includes(message.channel.id)) {
    // Only allow proposals in proposal channel
    //message.delete()
  }
  return false
}

async function deleteProposal(server, id) {
  console.log("deleting proposal:", id)
  let proposal = await server.database.get(`poposal:${id}`, { raw: false })
  if (proposal == null) {
    console.log("no proposal found")
    return
  }
  console.log("deleting proposal:", id)
  proposal = JSON.parse(proposal)
  Object.setPrototypeOf(proposal, Proposal.prototype)
  proposal.state = ARCHIVED_STATE
  await proposal.delete(server)
  activeProposals = activeProposals.filter(function(id) {
    return id != proposal.id;
  })
  console.log("updated active proposals:", activeProposals)
  await server.database.set(`poposals`, JSON.stringify(activeProposals))
}

async function handleMsgDelete(server, message) {
  if (message.content.toLowerCase().startsWith("proposal\n")) {
    deleteProposal(server, message.id)
    return true
  }
  return false
}
async function tryCommitProposal(server, proposal, message) {
  if (!await proposal.canCommit(server)) {
    return
  }
  let success = await proposal.commit(server)
  if (!success) {
    try {
      await message.reply('motion passed but error encountered, summoning <@&973809144157069332>...')
    } catch (error) {
      console.log("reaction message line reply error:", error)
    }
    return
  }
  // post message: motion passed
  try {
    await message.reply('motion passed!')
  } catch (error) {
    console.log("reaction message line reply error:", error)
  }
  // archive proposal 
  proposal.state = ARCHIVED_STATE
  await proposal.save(server)
  activeProposals = activeProposals.filter(function(id) {
    return id != proposal.id;
  })
  await server.database.set(`poposals`, JSON.stringify(activeProposals))
}

async function addReaction(server, reaction, user) {
  if (user.bot) {
    return false
  }
  if (activeProposals.includes(reaction.message.id)) {
    if (reaction._emoji.id != server.Emojis.AYE && reaction._emoji.id != server.Emojis.NAY) {
      reaction.users.remove(user.id)
      return true
    }
    // do handling
    let proposal = await server.database.get(`poposal:${reaction.message.id}`, { raw: false })
    if (proposal == null) {
      console.log("proposal not found!")
      return false
    }
    proposal = JSON.parse(proposal)
    Object.setPrototypeOf(proposal, Proposal.prototype)
    proposal.add(server, user.id, reaction._emoji.id)
    await tryCommitProposal(server, proposal, reaction.message)
    return true
  }
  return false
}

async function removeReaction(server, reaction, user) {
  console.log("remove - user:", user)
  if (user.bot) {
    return false
  }
  if (reaction._emoji.id != server.Emojis.AYE && reaction._emoji.id != server.Emojis.NAY) {
    return false
  }

  if (activeProposals.includes(reaction.message.id)) {
    // do handling
    let proposal = await server.database.get(`poposal:${reaction.message.id}`, { raw: false })
    if (proposal == null) {
      console.log("proposal not found!")
      return false
    }
    proposal = JSON.parse(proposal)
    Object.setPrototypeOf(proposal, Proposal.prototype)
    proposal.remove(server, user.id, reaction._emoji.id)
    await tryCommitProposal(server, proposal, reaction.message)
    return true
  }
  return false
}

exports.vote = {
  init: init,
  propose: propose,
  handleMsg: handleMsg,
  handleMessageDelete: handleMsgDelete,
  addReaction: addReaction,
  removeReaction: removeReaction,
  deleteProposal: deleteProposal
}