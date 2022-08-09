const { MessageEmbed, Permissions } = require('discord.js')

const CULTIST_READ_ONLY = 1
const CULTIST_READ_WRITE = 2
const EVERYONE_READ = 3
const EVERYONE_READ_WRITE = 4

async function setChannelPermissions(server, channel, mode){
    for(const cult of server.Cults.values()){
        let v = {VIEW_CHANNEL: true, SEND_MESSAGES: false}
        if(mode == CULTIST_READ_WRITE){
            v.SEND_MESSAGES = true
        }
        channel.permissionOverwrites.create(cult.roleId, v);
    }
}

exports.CULTIST_READ_ONLY = CULTIST_READ_ONLY
exports.CULTIST_READ_WRITE = CULTIST_READ_WRITE
exports.SetChannelPermissions = setChannelPermissions