const checkFirebase = require('.././etc/firebase')
const models = require('.././etc/models')
const Uuid = require('uuid').v4

module.exports = {
    async create(req, res) {
        const { token, name, timeframe, private } = req.body
        const { start, finish } = timeframe;
        const id = await checkFirebase(token)
        if (id != false) {
            const uuid = Uuid();
            const room = new models.Room({
                name,
                uuid,
                adminName: id.name,
                adminUuid: id.uid,
                timeframe: {
                    start,
                    finish
                },
                adminPfp: id.picture,
                private
            })
            try {
                await room.save()
                res.status(200).send({status: 'success', room: uuid})
            } catch (e) {
                res.status(500).send({status: 'error', error: 'Server error: ' + e.toString()})
            }
        } else {
            res.status(401).send({status: 'error', error: 'Not authenticated'})
        }
    },
    async get(req, res) {
        const rooms = await models.Room.find({ private: false }).sort({'timeframe.start': 'desc'})
        res.status(200).send({
            status: 'success',
            rooms: rooms
        })
    }
}