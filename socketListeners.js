// Handle available offers
socket.on('availableOffers', (offers) => {
    createOfferEls(offers);
});

// Handle new offers
socket.on('newOfferAwaiting', (offers) => {
    createOfferEls(offers);
});

// Handle answer response
socket.on('answerResponse', (offerObj) => {
    addAnswer(offerObj);
});

// Handle received ICE candidates
socket.on('receivedIceCandidateFromServer', (iceCandidate) => {
    addNewIceCandidate(iceCandidate);
});

// Handle transcribed messages
socket.on('transcribedMessage', (message) => {
    const sharedTextBox = document.querySelector('#shared-text-box');
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    sharedTextBox.appendChild(messageEl);
});

// Helper function to create offer elements
function createOfferEls(offers) {
    const answerEl = document.querySelector('#answer');
    offers.forEach(o => {
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`;
        newOfferEl.addEventListener('click', () => answerOffer(o));
        answerEl.appendChild(newOfferEl);
    });
}
