const Sequelize = require('sequelize');

module.exports = class Chat extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            chatType: {
                type: Sequelize.ENUM('user-chat', 'system', 'user-share'),
                allowNull: false,
            },
            username: { // user-chat, user-share
                type: Sequelize.STRING(50),
            },
            message: { // user-chat, system
                type: Sequelize.TEXT,
            },
            placeName: { // user-share
                type: Sequelize.STRING(50),
            },
            placeAddress: { // user-share
                type: Sequelize.STRING(100),
            },
            placeCategory: { // user-share
                type: Sequelize.STRING(50),
            },
            placeDistance: { // user-share
                type: Sequelize.FLOAT,
            },
            placeLink: { // user-share
                type: Sequelize.STRING(150),
            },
        }, {
            sequelize,
            timestamps: true,
            underscored: false,
            modelName: 'Chat',
            tableName: 'chats',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        })
    }

    static associate(db) {
        db.Chat.belongsTo(db.Room, { foreignKey: 'roomID', targetKey: 'roomID' });
    }
}
