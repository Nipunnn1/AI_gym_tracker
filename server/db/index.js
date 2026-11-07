const { Sequelize } = require('sequelize');
// Explicit require so Vercel's bundler includes pg (Sequelize loads it dynamically)
const pg = require('pg');

const databaseUrl = process.env.DATABASE_URL;
const pgPassword = process.env.PG_PASSWORD !== undefined ? process.env.PG_PASSWORD : 'postgres';

const sequelize = databaseUrl
    ? new Sequelize(databaseUrl, {
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
        dialectOptions: process.env.PGSSLMODE === 'require'
            ? { ssl: { require: true, rejectUnauthorized: false } }
            : {},
    })
    : new Sequelize(
        process.env.PG_DATABASE || 'ai_gym_trainer',
        process.env.PG_USER || 'postgres',
        pgPassword,
        {
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432', 10),
            dialect: 'postgres',
            dialectModule: pg,
            logging: false,
        }
    );

module.exports = sequelize;
