const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const PersonalRecord = sequelize.define('PersonalRecord', {
    userId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    exerciseId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    maxReps: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    maxRepsDate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
    bestQuality: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
    },
    bestQualityDate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
    longestDuration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    longestDurationDate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
    totalReps: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    totalSessions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    lastPerformedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
}, {
    indexes: [
        { fields: ['exerciseId'] },
        { unique: true, fields: ['userId', 'exerciseId'] },
    ],
});

module.exports = PersonalRecord;
