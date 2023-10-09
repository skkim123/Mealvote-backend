const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config')[env];
const Room = require('./room');
const Chat = require('./chat');
const Candidate = require('./candidate');

const db = {};
const sequelize = new Sequelize(
  config.database, config.username, config.password, config,
);
db.sequelize = sequelize;
db.Room = Room;
db.Chat = Chat;
db.Candidate = Candidate;


Room.init(sequelize);
Chat.init(sequelize);
Candidate.init(sequelize);

Room.associate(db);
Chat.associate(db);
Candidate.associate(db);

module.exports = db;