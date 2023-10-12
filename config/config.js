const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    development: {
        username: "root",
        password: process.env.DB_PASSWORD,
        database: "mealvote",
        host: "127.0.0.1",
        dialect: "mysql",
    },
    test: {},
    production: {
        username: process.env.PRODUCTION_DB_USERNAME,
        password: process.env.PRODUCTION_DB_PASSWORD,
        database: process.env.PRODUCTION_DB_NAME,
        host: process.env.PRODUCTION_DB_HOST,
        dialect: "mysql",
    },
};