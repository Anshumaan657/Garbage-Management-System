class ExpressError extends Error {
    constructor(statusCode, message){
        super(message);
        this.status = statusCode;
        this.message = message;
    }
}

module.exports = ExpressError;
