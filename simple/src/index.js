'use strict';

const { createLocalTracks, connect } = require('twilio-video');

const selfVideo = document.getElementById('self-video');
const participantVideo = document.getElementById('participant-video');
const params = new URLSearchParams(window.location.search);

let roomName = params.get('roomName');
let identity = params.get('identity');
let roomSid = params.get('roomSid');

let token = null;
let room = null;

const connectOptions = {
	bandwidthProfile: {
		video: {
			dominantSpeakerPriority: 'high',
			mode: 'collaboration',
			renderDimensions: {
				high: { height: 720, width: 1280 },
				standard: { height: 90, width: 160 }
			}
		}
	},
	logLevel: 'debug',
	maxAudioBitrate: 16000,
	video: {
		height: 720,
		frameRate: 24,
		width: 1280,
		maxSubscriptionBitrate: 2500000
	},
	name: roomName
};

fetch(`https://api.vcall.us/token/video/create?identity=${identity}&roomSid=${roomSid}&roomName=${roomName}`).then(response => {
	response.text().then(value => {
		token = value;

		createLocalTracks().then(tracks => {
			connectOptions.tracks = tracks;

			tracks.forEach(t => {
				selfVideo.appendChild(t.attach());
			});

			toggleVideoLocation(true, false);

			$('#start-call').removeClass('hidden');
			$('#stop-call').addClass('hidden');
		});
	})
});

//------------------------------------------------------------------------------------------------------------------
//-- Add Participant Video and Audio

function addParticipant(track) {
	if (track.isEnabled && room.localParticipant.identity !== track.identity) {
		console.warn(`Remote Participant Joined - ${track.identity}`);
		participantVideo.appendChild(track.attach());

		toggleVideoLocation(true, false);
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Connect Call to Twilio

function connectCall() {
	toggleVideoLocation(true, true);

	$('#start-call').addClass('hidden');
	$('#stop-call').removeClass('hidden');

	connect(token, connectOptions).then(r => {
		room = r;
		room.on('trackSubscribed', (t) => addParticipant(t));

		room.participants.forEach(p => {
			addParticipant(p);
			return true;
		});
	});
}

//------------------------------------------------------------------------------------------------------------------
//-- Connect Call to Twilio

function disconnectCall() {
	if(room != null) {
		room.disconnect();
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Toggle Video Window

function toggleVideoLocation(isSelf, isPrimary) {
	if ((isPrimary && isSelf) || (!isPrimary && !isSelf)) {
		participantVideo.classList.remove('primary');
		participantVideo.classList.add('secondary');

		selfVideo.classList.add('primary');
		selfVideo.classList.remove('secondary');
	}
	else {
		participantVideo.classList.add('primary');
		participantVideo.classList.remove('secondary');

		selfVideo.classList.remove('primary');
		selfVideo.classList.add('secondary');
	}
}


//------------------------------------------------------------------------------------------------------------------
//-- Before Unload

window.onbeforeunload = () => {
	disconnectCall();
}


//------------------------------------------------------------------------------------------------------------------
//-- Document Ready

$(document).ready(() => {
	$('#start-call').on('click', () => connectCall());
	$('#stop-call').on('click', () => disconnectCall());
});
