const { updater} = require('./updater');

exports.manager = {
  run: async () => {
    // clean recent users roles every 20 minutes
    setInterval( async () => {
      await batch.cleanRoles(new Date(new Date().getTime() - (25 * 60 * 1000)))
    } , 20 * 60 * 1000 ) // 20min
    
    // clean all users roles every 3hrs 7min
    setInterval( async () => {
      await batch.cleanRoles()
    }, 3 * 60 * 60 * 1000 + 7 * 60 * 1000) // every 3hrs 7min
  }
}