/* 

eslint + indent
try-catch 마치 노드교과서



<frontend>
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
const { sequelize, Room } = require('./models');

const PORT_NUM = 5000;

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

app.post('/rooms', async (req, res) => {
    const roomID = uuid.v4().replace(/-/g, '');
    await Room.create({
        roomID,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        votingInProgress: 'N',
        ownerID: req.sessionID,
    });
    res.send({ roomID });
});

app.get('/rooms/check/:roomID', (req, res) => {
    const roomID = req.params.roomID;
    Room.findOne({ where: { roomID } }).then((room) => {
        if (room) {
            res.send({
                isRoomExist: true,
                isOwner: room.ownerID === req.sessionID ? 'Y' : 'N',
                latitude: room.latitude,
                longitude: room.longitude,
                votingInProgress: room.votingInProgress,
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
    // const req = socket.request;
    const roomID = socket.handshake.query.roomID;
    Room.findOne({ where: { roomID } }).then(
        (room) => {
            if (room) {
                socket.join(roomID);
                socket.emit('join', { roomID });
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

    socket.on('message',()=>{
        
    });
});

server.listen(app.get('port'), () => {
    console.log(`server is running on ${app.get('port')}`);
});