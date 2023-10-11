/* 
eslint + indent
try-catch 마치 노드교과서
에러 페이지 미들웨어 장착??? 리액트랑 연결 시에는 어떻게
console.log 나 의미없는 공백 지우기
pm2 , winston 같은 국룰 패키지 덕지덕지

<frontend>
keywordSearch 할 때 FD6 카테고리 동봉? 아니면 음식점만 검색 토글버튼 넣기?
검색결과 pagination 기능
Votepage sprite 이미지로 마커 불러오기
스피너 추가
wheel로 지도 줌 인 아웃 가능하게 설정
채팅창 밑에 현재 참여자 명단 띄우거나 참여자 수 띄우기
투표 시 만약 공동 1등 나올 경우? -> 랜덤으로 1개 뽑기????
setState 인자 함수 형태로 바꿀 수 있는 것 바꾸기 ?
*/

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const fileStore = require('session-file-store')(session);
const dotenv = require('dotenv');
const morgan = require('morgan');
const uuid = require('uuid');
const cors = require('cors');
const { sequelize, Room, Chat, Candidate } = require('./models');
const phraseGenerator = require('korean-random-words');

const PORT_NUM = 5000;
const phraseGen = new phraseGenerator();

dotenv.config();

const app = express();
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));
app.use(morgan('dev'));
app.set('port', process.env.PORT || PORT_NUM);
sequelize.sync({ force: false })
    .then(() => {
        console.log('DB connected');
    })
    .catch((err) => {
        console.error(err);
    });
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));
const sessionMiddleware = session({
    resave: false,
    saveUninitialized: true,
    secret: process.env.COOKIE_SECRET,
    cookie: {
        httpOnly: true,
        secure: false,
    },
    store: new fileStore(),
});
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
                voteCount : JSON.parse(room.voters).length,
            });
        } else {
            res.send({ isRoomExist: false });
        }
    });
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
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
        } else { // still has users in the room

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

    socket.on('voteFinish',()=>{
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