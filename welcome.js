var msgs = [
  "aelїn {mention}",
  "aelїn {mention}",
  "aelїn {mention}",
  "aelїn {mention}",
  "aelїn {mention}",
  "aelїn {mention}, you are more beautiful than i remember",
  "aelїn {mention}, my old friend... what. you don't recognize me?",
  "{mention} {mention} {mention} {mention}. a good zealous name, easy on the tongue. well, if i had one.",
  "aelїn {mention}, hold this knife. no no it's not for you [it's for you].",
  "{mention}, my favorite wanderer. come in for your blood ritual",
  "why if it isn't ol' {mention}, the one i made in my image. a turtle.",
"wherefore art thou {mention}? oh, there you are. come in, leave your cloak with me",
  "aelїn {mention}, so glad you have awoken. come in. shed your mind. forget the illusion of being. become the flipped bit. become dust.",
]
async function sendWelcomeMsg(server, user){
  let msg = msgs[Math.floor(Math.random() * msgs.length)]
  msg = msg.replace(/{mention}/g, `${user}`);
  let welcomeChannel = server.client.channels.cache.get(server.WelcomeChannelId)
  welcomeChannel.send(msg)
}

exports.welcome = sendWelcomeMsg