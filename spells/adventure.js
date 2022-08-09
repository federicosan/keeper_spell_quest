
async function log(server, message) {
    let channel = server.client.channels.cache.get(server.channels.AdventureLogChannelId)
    await channel.send(message)
}

exports.adventure = {
    log: log
}