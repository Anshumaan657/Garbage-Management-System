const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        unique: [true, 'username must be unique'],
        index: true
    },
    password: {
        type: String,
        required: true,
        trim: true,
    },
    email:{
        type: String,
        trim: true,
        lowercase: true,
        index: true,
        validate: {
            validator: function(v) {
                return v === '' || /^\S+@\S+\.\S+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        },
        required: true,
    },
    phone:{
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^\d{10}$/.test(v);
            },
            message: props => `${props.value} is not a valid 10-digit phone number!`
        },     
    },
    role:{
        type: String,
        enum: {values: ['customer', 'admin', 'worker'], message: "{VALUE} is not supported"},
        default: 'customer',
        required: true,
    },
    region: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "regions",
        required: false,
    },
    slot: {
        type: String,
        enum: { values: ['morning', 'afternoon', 'evening'], message: "{VALUE} is not supported. Supported: ['morning', 'afternoon', 'evening']" },
        required: false,
    }
})

module.exports = mongoose.model("user", userSchema);
