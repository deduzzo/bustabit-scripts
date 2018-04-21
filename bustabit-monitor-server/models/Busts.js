var mongoose = require('mongoose');

var ProductSchema = new mongoose.Schema({
    id: {
            type: Number,
            unique: true
    },
    bust: Number,
    hash: String,
    date: {
        type: Date,
        default: Date.now
    },
    bets: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('Busts', ProductSchema);