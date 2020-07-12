const models = require('./models')

module.exports = async (userUid, room) => {
    const roomDoc = await models.Room.findOne({'uuid': room})
    if (roomDoc.adminUuid === userUid) {
        return true 
    } else {
        return false
    }
}