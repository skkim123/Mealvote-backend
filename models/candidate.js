const Sequelize = require('sequelize');

module.exports = class Candidate extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            placeID: {
                type: Sequelize.STRING(20),
                allowNull: false,
            },
            placeName: {
                type: Sequelize.STRING(50),
                allowNull: false,
            },
            placeCaterory: {
                type: Sequelize.STRING(20),
            },
            placeAddress: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            placeDistance: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            placePhone: {
                type: Sequelize.STRING(20),
            },
            placeURL: {
                type: Sequelize.STRING(100),
            },
            placeLatitude: {
                type: Sequelize.FLOAT,
            },
            placeLongitude: {
                type: Sequelize.FLOAT,
            },
        }, {
            sequelize,
            timestamps: true,
            underscored: false,
            modelName: 'Candidate',
            tableName: 'candidates',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        })
    }

    static associate(db) {
        db.Chat.belongsTo(db.Room, { foreignKey: 'roomID', targetKey: 'roomID' });
    }
}
