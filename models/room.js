const Sequelize = require('sequelize');

module.exports = class Room extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            roomID: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true,
            },
            ownerID: {
                type: Sequelize.STRING(50),
                allowNull: false,
            },
            latitude: {
                type: Sequelize.FLOAT,
                allowNull: false,
            },
            longitude: {
                type: Sequelize.FLOAT,
                allowNull: false,
            },
            votingInProgress: {
                type: Sequelize.STRING(1),
                allowNull: false,
            },
        }, {
            sequelize,
            timestamps: true,
            underscored: false,
            modelName: 'Room',
            tableName: 'rooms',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        })
    }

    static associate(db) {
        db.Room.hasMany(db.Chat, { foreignKey: 'roomID', sourceKey: 'roomID', onDelete: 'CASCADE' });
        db.Room.hasMany(db.Candidate, { foreignKey: 'roomID', sourceKey: 'roomID', onDelete: 'CASCADE' });
    }
}
