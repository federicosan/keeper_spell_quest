exports.getAllPastReferralsSet = function(user) {
  let all = user.referrals ? new Set(user.referrals) : new Set()
  if (user.history && user.history.length > 0) {
    for (var entry of user.history) {
      if (entry.referrals && entry.referrals.length > 0) {
        for (var ref of entry.referrals) {
          all.add(ref)
        }
      }
    }
  }
  return all
}

exports.getAllPastChantsCount = function(user) {
  let sum = user.num_chants ? user.num_chants : 0
  if (user.history && user.history.length > 0) {
    for (var entry of user.history) {
      if (entry.num_chants && entry.num_chants > 0) {
        sum += entry.num_chants
      }
    }
  }
  return sum
}

exports.getAllPastPoints = function(user) {
  let sum = user.points ? user.points : 0
  if (user.history && user.history.length > 0) {
    for (var entry of user.history) {
      if (entry.points && entry.points > 0) {
        sum += entry.points
      }
    }
  }
  return sum
}