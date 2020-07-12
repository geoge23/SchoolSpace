const express = require('express');
const path = require('path')

const bodyparser = require('body-parser').json
const app = express()
app.use(bodyparser())
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const checkFirebase = require('./etc/firebase')
const roomsMethods = require('./endpoints/rooms')
const models = require('./etc/models')
const isUserRoomAdmin = require('./etc/IsUserRoomAdmin');
const { create } = require('./endpoints/rooms');

//anti cors for testing
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    next()
})

app.get('/api/ad', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'intro.webm'))
    console.log('file sent')
})
//creates socketio room and stores to mongo
app.put('/api/room', roomsMethods.create)
//gets all available rooms from mongo
app.get('/api/room', roomsMethods.get)
//retrieves question by id as mp3
//app.get('/api/question', rooms.question)

let rooms = {}
let sockets = new Map()
let firstChunks = {}

io.on('connection', socket => {
    console.log(socket.id, 'connected')
    //requests permission for socket to be moved from waiting to active room, requires host approval
    //should contain firebase auth so can be linked server-side
    socket.on('join-room', async (data) => {
        const { token, room } = data;
        const userInfo = await checkFirebase(token)
        //prevents users from jumping uuids from ones with permissions to those without
        sockets.delete(socket.id)

        const uid = userInfo.uid
        const socketInfo = {};
        if (token != false) {
            let isSpeaking;
            //checks if user is admin and if so sets them as speaker
            if (await isUserRoomAdmin(userInfo.uid, room)) {
                isSpeaking = true;
                socketInfo['can-stream'] = true;
            } else {
                isSpeaking = false;
            }
            if (!rooms.hasOwnProperty(room)) {
                rooms[room] = {}
                rooms[room][uid] = {
                    name: userInfo.name,
                    img: userInfo.picture,
                    isSpeaking,
                    isWaving: false
                }
            } else {
                rooms[room][uid] = {
                    name: userInfo.name,
                    img: userInfo.picture,
                    isSpeaking,
                    isWaving: false
                }
            }
            socket.join(room)
            socketInfo['video-room'] = room;
            socketInfo['user-info'] = userInfo;
            sockets.set(socket.id, socketInfo)
            socket.emit('room-joined')
            io.to(room).emit('room-manifest', rooms[room])
        } else {
            socket.emit('error', {status: 'error', error: 'Failed to authenticate...'})
        }
    })

    //checks users in room and returns information
    socket.on('room-manifest', () => {
        const room = sockets.get(socket.id)['video-room']
        const data = rooms[room]

        console.log(data)

        socket.emit('room-manifest', data)
    })

    //sends question mp3 for processing
    //will be sent to host as url to mp3 with stt info until played
    //socket.on('ask-question', manager.ask)

    //sends blob (or arraybuffer) to all clients in room
    socket.on('video-ready', (data) => {
        if (!sockets.has(socket.id) /*|| !sockets.get(socket.id)['can-stream']*/) {
            console.log(socket.id, 'is streaming without authorization')
            return;
        }

        const room = sockets.get(socket.id)['video-room']

        if (!firstChunks[room]) {
            firstChunks[room] = data;
            console.log(firstChunks[room], 'firstChunks')
        }

        
        console.log(data, 'to', room)
        io.to(room).emit('new-data', data)
    })

    socket.on('get-first-chunks', () => {
        console.log('FIRSTCHUNKS!')
        if (!sockets.has(socket.id)) {
            console.log('socket not registered')
            return;
        }
        const room = sockets.get(socket.id)['video-room']
        socket.emit('first-chunks', firstChunks[room])
    })

    //socket.on('debug', data => console.log(data, socket.rooms, socket.id))

    socket.on('close-room', async () => {
        const socketDoc = sockets.get(socket.id);
        const uid = socketDoc['user-info'].uid;
        const room = socketDoc['video-room']
        console.log('closing room', room)
        if (await isUserRoomAdmin(uid, room)) {
            console.log(uid, 'is closing room', room)
            io.to(socketDoc['video-room']).emit('close-room')
            models.Room.deleteOne({'uuid': socket['video-room']}, (err, res) => {
                console.log(err, 'Room is deleted')
            })
        } else {
            socket.emit('error', {status: 'error', error: 'Failed to authenticate...'})
        }
    })

    socket.on('message', (msg) => {
        const socketDoc = sockets.get(socket.id);
        const qDoc = {
            name: socketDoc['user-info'].name,
            pic: socketDoc['user-info'].picture,
            question: msg
        }
        io.to(socketDoc['video-room']).emit('new-msg', qDoc)
    })

    socket.on('disconnect', () => {
        const id = socket.id
        if (sockets.has(id)) {
            const socketDoc = sockets.get(id);
            const room = socketDoc['video-room']
            console.log(socketDoc['user-info'].uid)
            sockets.delete(id)
            delete rooms[room][socketDoc['user-info'].uid]
            console.log(rooms[room], rooms[room][socketDoc['user-info'].uid])
            io.to(socketDoc['video-room']).emit('room-manifest', rooms[room])
        }
        console.log(sockets)
        console.log(socket.id, 'disconnected')
    })


})

http.listen(3000, () => {
    console.log('listening on *:3000');
  });
