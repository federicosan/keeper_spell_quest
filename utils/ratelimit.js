class RateLimiter {
    constructor(limit, period){
      this.lastPeriodStart = 0
      this.count = 0
      this.limit = limit
      this.period = period
    }
  
    async try(call){
      if(this.count > this.limit){
        let expectedStart = Date.now() - this.period
        if ( expectedStart <= this.lastPeriodStart) {
          // wait and retry
          console.log("RateLimiter: waiting to retry...")
          let remaining = this.period - (Date.now() - this.lastPeriodStart)
          setTimeout(() => {
            this.try(call)
          }, Math.floor(remaining + Math.random() * this.period * 0.5))
          return
        } else {
          this.lastPeriodStart = Date.now()
          this.count = 0
        }
      }
      this.count++
      call()
    }
  }
  
  exports.RateLimiter = RateLimiter