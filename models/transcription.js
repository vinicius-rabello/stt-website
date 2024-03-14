const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const transcriptionSchema = new Schema({
    filename: {
        type: String,
        required: true
    },
    transcription: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    }
}, {timestamps: true});

const Transcription = mongoose.model('Transcription', transcriptionSchema);

module.exports = Transcription;