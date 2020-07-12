const mongoose = require('mongoose');
mongoose.connect('redacted', { useNewUrlParser: true, useUnifiedTopology: true})

module.exports = {
    Room: mongoose.model('Room', {
        name: String,
        uuid: String,
        adminName: String,
        adminUuid: String,
        timeframe: {
            start: String,
            finish: String
        },
        adminPfp: String,
        private: Boolean
    })
}