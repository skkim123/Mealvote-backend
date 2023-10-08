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
    test: {
        username: "root",
        password: process.env.DB_PASSWORD,
        database: "",
        host: "127.0.0.1",
        dialect: "mysql",
    },
    production: {
        //
    },
};