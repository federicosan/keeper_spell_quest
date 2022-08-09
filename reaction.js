exports.handleReaction = async function(reaction, user)  {
  if(reaction._emoji.id == "976203184802496562" && user.id != "974842656372953118" && reaction.message.channelId == "978078135193071657"){
    reaction.users.remove(user.id)
  }
}