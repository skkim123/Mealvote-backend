const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const dotenv = require('dotenv');
const morgan = require('morgan');
const uuid = require('uuid');
const cors = require('cors');
const { sequelize, Room, Chat, Candidate } = require('./models');
const phraseGenerator = require('korean-random-words');
const phraseGen = new phraseGenerator();
const LOCAL_PORT_NUM = 5000;

dotenv.config();

const app = express();
app.use(cors({
    origin: process.env.ORIGIN || 'http://localhost:3000',
    credentials: true,
}));

if(process.env.NODE_ENV === 'production'){
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

app.set('port', process.env.PORT || LOCAL_PORT_NUM);

sequelize.sync({ force: false })
    .then(() => {
        console.log('DB connected');
    })
    .catch((err) => {
        console.error(err);
    });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.resolve(__dirname, '..', 'frontend', 'build')));
app.use(cookieParser(process.env.COOKIE_SECRET));

const sessionStore = new MySQLStore({
    host: process.env.PRODUCTION_DB_HOST || 'localhost',
    port: 3306,
    user: process.env.PRODUCTION_DB_USERNAME || 'root',
    password: process.env.PRODUCTION_DB_PASSWORD || process.env.DB_PASSWORD,
    database: 'sessions',
});

const sessionOption = {
    resave: false,
    saveUninitialized: true,
    secret: process.env.COOKIE_SECRET,
    cookie: {
        httpOnly: true,
        secure: false,
    },
    store: sessionStore,
}

if(process.env.NODE_ENV === 'production'){
    sessionOption.cookie.secure = true;
    sessionOption.proxy = true;
}

const sessionMiddleware = session(sessionOption);

app.use(sessionMiddleware);
app.use((req, res, next) => {
    if (!req.session.username) {
        req.session.username = phraseGen.generatePhrase().replace(/-/g, ' ');
    }
    next();
});

app.post('/rooms', async (req, res) => {
    const roomID = uuid.v4().replace(/-/g, '');
    await Room.create({
        roomID,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        votingInProgress: 'N',
        ownerID: req.sessionID,
        voters: "[]",
    });
    res.send({ roomID });
});

app.get('/rooms/check/:roomID', (req, res) => {
    const roomID = req.params.roomID;
    Room.findOne({ where: { roomID }, include: [{ model: Chat }, { model: Candidate }] }).then((room) => {
        if (room) {
            res.send({
                isRoomExist: true,
                isOwner: room.ownerID === req.sessionID ? 'Y' : 'N',
                latitude: room.latitude,
                longitude: room.longitude,
                votingInProgress: room.votingInProgress,
                chats: room.Chats.sort((a, b) => a.createdAt - b.createdAt),
                name: req.session.username,
                candidates: room.Candidates,
                voteCount: JSON.parse(room.voters).length,
            });
        } else {
            res.send({ isRoomExist: false });
        }
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'build', 'index.html'));
});


let server;
if(process.env.NODE_ENV === 'production'){
    server = https.createServer({
        cert: fs.readFileSync('./cert/cert.pem'),
        key: fs.readFileSync('./cert/key.pem'),
    }, app);
} else {
    server = http.createServer(app);
}

const io = new Server(server, {
    cors: {
        origin: process.env.ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    }
});

io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res, next);
});

io.on('connection', (socket) => {
    const roomID = socket.handshake.query.roomID;
    Room.findOne({ where: { roomID } }).then(
        (room) => {
            if (room) {
                socket.join(roomID);
                Chat.create({
                    chatType: 'system',
                    message: `${socket.request.session.username} 님이 입장하셨습니다.`,
                    roomID,
                }).then((chat) => {
                    io.to(roomID).emit('system', chat);
                });
            }
        }
    );

    socket.on('disconnect', () => {
        console.log('user disconnected');
        socket.leave(roomID);
        if (!socket.adapter.rooms.has(roomID) || !(socket.adapter.rooms.get(roomID)?.size)) {
            Room.destroy({ where: { roomID } });
        }
    });

    socket.on('userChat', (message) => {
        Chat.create({
            chatType: 'user-chat',
            username: socket.request.session.username,
            message,
            roomID,
        }).then((chat) => {
            io.to(roomID).emit('userChat', chat);
        });
    });

    socket.on('userShare', (place) => {
        Chat.create({
            chatType: 'user-share',
            username: socket.request.session.username,
            roomID,
            placeName: place.place_name,
            placeAddress: place.address_name,
            placeCategory: place.category_name?.split('>').slice(-1)[0],
            placeDistance: place.distance,
            placeURL: place.place_url,
        }).then((chat) => {
            io.to(roomID).emit('userShare', chat);
        });
    });

    socket.on('addCandidate', (place) => {
        Candidate.findOne({ where: { roomID, placeID: place.id } }).then((candidate) => {
            if (!candidate) {
                Candidate.create({
                    placeID: place.id,
                    placeName: place.place_name,
                    placeCategory: place.category_name?.split('>').slice(-1)[0],
                    placeAddress: place.address_name,
                    placeDistance: place.distance,
                    placePhone: place.phone,
                    placeURL: place.place_url,
                    placeLatitude: place.y,
                    placeLongitude: place.x,
                    roomID,
                }).then((candidate) => {
                    io.to(roomID).emit('addCandidate', candidate);
                });
            }
        });
    });

    socket.on('deleteCandidate', (candidate) => {
        Candidate.destroy({ where: { roomID, placeID: candidate.placeID } }).then(() => {
            io.to(roomID).emit('deleteCandidate', candidate);
        });
    });

    socket.on('voteStart', () => {
        io.to(roomID).emit('system', { chatType: 'system', message: '투표가 곧 시작됩니다...' });
        setTimeout(() => {
            Room.update({ votingInProgress: 'Y' }, { where: { roomID } }).then(() => {
                io.to(roomID).emit('voteStart');
                io.to(roomID).emit('system', { chatType: 'system', message: '투표 시작 !' });
            });
        }, 3000);
    });

    socket.on('vote', (candidate) => {
        const req = socket.request;
        Room.findOne({ where: { roomID } }).then((room) => {
            const voters = JSON.parse(room.voters);

            const idx = voters.findIndex(obj => obj.username === req.session.username);
            if (idx === -1) {
                voters.push({ username: req.session.username, placeID: candidate.placeID });
                Room.update({ voters: JSON.stringify(voters) }, { where: { roomID } }).then(() => {
                    io.to(roomID).emit('vote', voters.length);
                });
            } else {
                voters[idx].placeID = candidate.placeID;
                Room.update({ voters: JSON.stringify(voters) }, { where: { roomID } }).then(() => {
                    io.to(roomID).emit('vote', voters.length);
                });
            }
        });
    });

    socket.on('voteFinish', () => {
        io.to(roomID).emit('system', { chatType: 'system', message: '투표가 곧 종료됩니다...' });
        io.to(roomID).emit('system', { chatType: 'system', message: '공동 1등이 있을 경우 그 중 무작위로 결정됩니다.' });
        setTimeout(() => {
            const voteResult = {};
            Room.findOne({ where: { roomID } }).then((room) => {
                const voters = JSON.parse(room.voters);
                voters.forEach((voter) => {
                    if (voteResult[voter.placeID]) {
                        voteResult[voter.placeID] += 1;
                    } else {
                        voteResult[voter.placeID] = 1;
                    }
                });
                const maxVote = Math.max(...Object.values(voteResult));
                const maxVoteCandidates = Object.keys(voteResult).filter((key) => voteResult[key] === maxVote);
                const winner = maxVoteCandidates[Math.floor(Math.random() * maxVoteCandidates.length)];
                Candidate.findOne({ where: { roomID, placeID: winner } }).then((candidate) => {
                    io.to(roomID).emit('system', { chatType: 'system', message: '투표가 종료되었습니다.' });
                    io.to(roomID).emit('voteFinish', candidate);
                });
            });
        }, 3000);
    });
});

server.listen(app.get('port'), () => {
    console.log(`server is running on ${app.get('port')}`);
});