const fs = require('fs');
const https = require('https');
const express = require('express');
const app = express();
const socketio = require('socket.io');

app.use(express.static(__dirname));

const key = fs.readFileSync('cert.key');
const cert = fs.readFileSync('cert.crt');

const expressServer = https.createServer({ key, cert }, app);
const io = socketio(expressServer, {
    cors: {
        origin: [
            "https://localhost",
            "https://192.168.0.107"
        ],
        methods: ["GET", "POST"]
    }
});
expressServer.listen(8181);

const offers = [];
const connectedSockets = [];

io.on('connection', (socket) => {
    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if (password !== "x") {
        socket.disconnect(true);
        return;
    }

    connectedSockets.push({
        socketId: socket.id,
        userName
    });

    // Emit available offers to new clients
    if (offers.length) {
        socket.emit('availableOffers', offers);
    }

    // Handle new offer
    socket.on('newOffer', (newOffer) => {
        offers.push({
            offererUserName: userName,
            offer: newOffer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: []
        });
        socket.broadcast.emit('newOfferAwaiting', offers.slice(-1));
    });

    // Handle new answer
    socket.on('newAnswer', (offerObj, ackFunction) => {
        const socketToAnswer = connectedSockets.find(s => s.userName === offerObj.offererUserName);
        if (!socketToAnswer) return;

        const socketIdToAnswer = socketToAnswer.socketId;
        const offerToUpdate = offers.find(o => o.offererUserName === offerObj.offererUserName);
        if (!offerToUpdate) return;

        ackFunction(offerToUpdate.offerIceCandidates);
        offerToUpdate.answer = offerObj.answer;
        offerToUpdate.answererUserName = userName;
        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate);
    });

    // Handle ICE candidates
    socket.on('sendIceCandidateToSignalingServer', (iceCandidateObj) => {
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;

        const offerInOffers = didIOffer
            ? offers.find(o => o.offererUserName === iceUserName)
            : offers.find(o => o.answererUserName === iceUserName);

        if (offerInOffers) {
            if (didIOffer) {
                offerInOffers.offerIceCandidates.push(iceCandidate);
            } else {
                offerInOffers.answererIceCandidates.push(iceCandidate);
            }

            const targetUserName = didIOffer ? offerInOffers.answererUserName : offerInOffers.offererUserName;
            const targetSocket = connectedSockets.find(s => s.userName === targetUserName);

            if (targetSocket) {
                socket.to(targetSocket.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
            }
        }
    });

    // Handle speech-to-text messages
    socket.on('speechToText', (message) => {
        // Broadcast the transcribed message to all connected clients
        socket.broadcast.emit('transcribedMessage', message);
    });
});
