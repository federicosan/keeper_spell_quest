const { server } = require('../server')
const { batch } = require('./batch')
const { toHrMin } = require('../utils/time')
const { IS_RESTARTING } = require('./state')

const lastChapterEndTime = 1660935600 * 1000
const chapterStartTime = 1661558400 * 1000  // 1661558400 * 1000 // 
const nextChapaterEndTime = 1662163200 * 1000 

var HasCheckpointed = false

async function update() {
  let channel = server.getChannel(server.channels.GameTimerChannelId)
  let now = Date.now()
  if (now >= nextChapaterEndTime) {
    if (!HasCheckpointed || channel.name != 'RESTARTING...') {
      await batch.checkpoint(new Date())
      HasCheckpointed = true
    }
    try {
      await channel.setName("RESTARTING...")
    } catch (error) {
      console.log("setName error:", error)
    }
    throw new Error("game over")
    return
  }
  let remaining = nextChapaterEndTime - now
  let name = "⏳ " + toHrMin(Math.floor(remaining / 1000))
  console.log("clock update:", name)
  try {
    await channel.setName(name)
  } catch (error) {
    console.log("setName error:", error)
  }
  return
}

async function run() {
  if (IS_RESTARTING) {
    return
  }
  update()
  setInterval(() => {
    update()
  }, 5 * 60000 + Math.floor(Math.random() * 60000))
}

exports.clock = {
  run: run,
  update: update
}

exports.LastChapterEndTime = lastChapterEndTime
exports.ChapterStartTime = chapterStartTime
exports.ChapterEndTime = nextChapaterEndTime