const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config')[env];
const Room = require('./room');
const Chat = require('./chat');

const db = {};
const sequelize = new Sequelize(
  config.database, config.username, config.password, config,
);
db.sequelize = sequelize;
db.Room = Room;
db.Chat = Chat;

Room.init(sequelize);
Chat.init(sequelize);

Room.associate(db);
Chat.associate(db);

module.exports = db;