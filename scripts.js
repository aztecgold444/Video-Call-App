// Updated `scripts.js`
const userName = "Rob-" + Math.floor(Math.random() * 100000);
const password = "x";
document.querySelector('#user-name').innerHTML = userName;

const socket = io.connect('https://192.168.0.107:8181/', {
    auth: {
        userName, password
    }
});

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');
const sharedTextBox = document.querySelector('#shared-text-box');
const speechToTextButton = document.querySelector('#speech-to-text');
const answerContainer = document.querySelector('#answer');

let localStream; // local video stream
let remoteStream; // remote video stream
let peerConnection; // WebRTC peer connection
let didIOffer = false;
let isSpeechToTextActive = false;
let recognition; // Speech recognition instance

const peerConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ]
};

const call = async () => {
    try {
        await fetchUserMedia();
        await createPeerConnection();

        console.log("Creating offer...");
        const offer = await peerConnection.createOffer();
        peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer', offer);
    } catch (err) {
        console.error("Error during call setup:", err);
    }
};

const hangup = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
    sharedTextBox.innerHTML = ''; // Clear shared text box
    answerContainer.innerHTML = ''; // Clear answer buttons
    console.log("Call ended.");
};

const answerOffer = async (offerObj) => {
    try {
        await fetchUserMedia();
        await createPeerConnection(offerObj);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        offerObj.answer = answer;
        const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj);
        offerIceCandidates.forEach(c => peerConnection.addIceCandidate(c));
    } catch (err) {
        console.error("Error answering offer:", err);
    }
};

const addAnswer = async (offerObj) => {
    try {
        await peerConnection.setRemoteDescription(offerObj.answer);
    } catch (err) {
        console.error("Error adding answer:", err);
    }
};

const fetchUserMedia = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoEl.srcObject = stream;
        localStream = stream;
        console.log("Local media stream initialized.");
    } catch (err) {
        console.error("Error accessing media devices:", err);
        throw err;
    }
};

const createPeerConnection = (offerObj) => {
    return new Promise(async (resolve, reject) => {
        try {
            peerConnection = new RTCPeerConnection(peerConfiguration);
            remoteStream = new MediaStream();
            remoteVideoEl.srcObject = remoteStream;

            if (localStream) {
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
            } else {
                console.error("Local stream is not available to add tracks.");
            }

            peerConnection.addEventListener('icecandidate', e => {
                if (e.candidate) {
                    socket.emit('sendIceCandidateToSignalingServer', {
                        iceCandidate: e.candidate,
                        iceUserName: userName,
                        didIOffer
                    });
                }
            });

            peerConnection.addEventListener('track', e => {
                e.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
            });

            if (offerObj) {
                await peerConnection.setRemoteDescription(offerObj.offer);
            }

            resolve();
        } catch (err) {
            console.error("Error creating peer connection:", err);
            reject(err);
        }
    });
};

const startSpeechToText = () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert('Speech recognition is not supported in this browser.');
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript) {
            const message = `${userName}: ${finalTranscript}`;
            socket.emit('speechToText', message);
            appendToSharedTextBox(message);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
        if (isSpeechToTextActive) recognition.start();
    };

    recognition.start();
};

const appendToSharedTextBox = (message) => {
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    sharedTextBox.appendChild(messageEl);
};

const createAnswerButton = (offerObj) => {
    const button = document.createElement('button');
    button.className = 'btn btn-success';
    button.textContent = `Answer Call from ${offerObj.offererUserName}`;
    button.addEventListener('click', () => answerOffer(offerObj));
    answerContainer.appendChild(button);
};

socket.on('newOfferAwaiting', (offers) => {
    answerContainer.innerHTML = ''; // Clear previous buttons
    offers.forEach(createAnswerButton);
});

speechToTextButton.addEventListener('click', () => {
    if (isSpeechToTextActive) {
        isSpeechToTextActive = false;
        speechToTextButton.textContent = 'Start Speech to Text';
        if (recognition) recognition.stop();
    } else {
        isSpeechToTextActive = true;
        speechToTextButton.textContent = 'Stop Speech to Text';
        startSpeechToText();
    }
});

document.querySelector('#call').addEventListener('click', call);
document.querySelector('#hangup').addEventListener('click', hangup);

socket.on('transcribedMessage', (message) => {
    appendToSharedTextBox(message);
});
