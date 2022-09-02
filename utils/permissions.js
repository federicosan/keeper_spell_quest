const { MessageEmbed, Permissions } = require('discord.js')

var PERMISSIONS = {
    READ: 1,
    WRITE: 2,
    REACT: 4
}

const CULTIST_READ_ONLY = PERMISSIONS.READ | PERMISSIONS.REACT
const CULTIST_READ_WRITE = CULTIST_READ_ONLY | PERMISSIONS.WRITE

async function SetChannelPermissions(server, channel, mode, roles = null){
    if(!roles){
        roles = [server.Roles.Cultist]
    }
    let v = {VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS: false}
    if(mode & PERMISSIONS.WRITE){
        v.SEND_MESSAGES = true
    }
    if(mode & PERMISSIONS.REACT){
        v.ADD_REACTIONS = true
    }
    for(let role of roles){
        channel.permissionOverwrites.create(role, v)
    }
}


exports.PERMISSIONS = PERMISSIONS
exports.CULTIST_READ_ONLY = CULTIST_READ_ONLY
exports.CULTIST_READ_WRITE = CULTIST_READ_WRITE
exports.SetChannelPermissions = SetChannelPermissions