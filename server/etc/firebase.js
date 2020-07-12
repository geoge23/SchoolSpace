const admin = require('firebase-admin')
const serviceAcct = require('C:\\Users\\George\\Documents\\schoolspace-key.json')

admin.initializeApp({
    credential: admin.credential.cert(serviceAcct),
    databaseURL: "https://schoolspace-e023a.firebaseio.com"
});

const auth = admin.auth()

module.exports = async (token) => {
    try {
        const id = await auth.verifyIdToken(token) 
        return id;
    } catch (_) {
        return false;
    }
}

