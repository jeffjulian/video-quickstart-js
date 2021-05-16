'use strict';

const { createLocalTracks, createLocalVideoTrack, createLocalAudioTrack, connect } = require('twilio-video');

const selfVideo = document.getElementById('self-video');
const participantVideo = document.getElementById('participant-video');
const params = new URLSearchParams(window.location.search);

let roomName = params.get('roomName');
let identity = params.get('identity');
let roomSid = params.get('roomSid');
let messageElement = $('#message');

const participantInfo = $('#participant-info-section');
const participantName = $('#participant-name', participantInfo);
const participantBirthdate = $('#participant-birthdate', participantInfo);

//-- Server-side Fill Elements
let isPharmacy = true; 
let name = 'Jeff Julian';
let birthDate = 'May 3, 1981';

let token = null;
let room = null;
let roomJoined = false;

let tracks = null;
let videoTrack = null;
let audioTrack = null;

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

if(isPharmacy) {
	participantInfo.removeClass('hidden');
	participantName.html(name);
	participantBirthdate.html(birthDate);
}

messageElement.html('Loading...');

fetch(`https://dev.vcall.us/scripts/token?identity=${identity}&roomSid=${roomSid}&roomName=${roomName}`).then(response => {
	response.text().then(value => {
		token = value;
		prepareComponents();
	})
});

//------------------------------------------------------------------------------------------------------------------
//-- Prepare Components for Connecting to Video Service

function prepareComponents() {
	if(token !== null && token !== undefined && token.length > 0) {
		var roomElement = $('div#room');
		roomElement.removeClass('loading');

		messageElement.html('Telehealth Preview');
		console.log(`token: ${token}`);

		createLocalTracks().then(t => {
			tracks = t;
			connectOptions.tracks = tracks;

			tracks.forEach(track => {
				if(track.kind === 'video') { videoTrack = track; }
				else if(track.kind === 'audio') { audioTrack = track; }

				selfVideo.appendChild(track.attach());
			});

			toggleVideoLocation(true, true);
			afterRoomChanged(false);
		});
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Add Participant Video and Audio

document.addEventListener("visibilitychange", async () => {
	console.info('visibility changed ' + document.visibilityState);

	if(document.visibilityState == 'hidden') {
		if(videoTrack !== null && audioTrack !== null) {
			console.info('Stop Tracks');
			videoTrack.stop();
			audioTrack.stop();

			if(room !== null && room.localParticipant !== null) {
				await room.localParticipant.unpublishTrack(videoTrack);
				await room.localParticipant.unpublishTrack(audioTrack);
			}
		}
	}
	else {
		audioTrack = await createLocalAudioTrack();
		videoTrack = await createLocalVideoTrack();

		selfVideo.appendChild(videoTrack.attach());
		selfVideo.appendChild(videoTrack.attach());
			
		if(room !== null && room.localParticipant !== null) {
			await room.localParticipant.publishTrack(videoTrack);
			await room.localParticipant.publishTrack(audioTrack);
		}
	}
});

//------------------------------------------------------------------------------------------------------------------
//-- Add Participant Video and Audio

function addParticipant(track) {
	if (track.isEnabled && room.localParticipant.identity !== track.identity) {

		console.warn(`Remote Participant Joined - ${track.identity}`);
		participantVideo.appendChild(track.attach());

		toggleVideoLocation(true, false);
		afterRoomChanged(true); 
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Toggle Call to Twilio

function toggleCall(connect) {
	console.log(`toggleCall(${connect})`);

	if(!connect) {
		connectCall();
	}
	else {
		disconnectCall();
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Connect Call to Twilio

function connectCall() {
	console.log('connectCall() started');
	messageElement.html('Connecting...');

	toggleVideoLocation(true, true);

	connect(token, connectOptions).then(r => {
		room = r;

		toggleVideoLocation(true, false);
		console.log(`connecting to room ${room.name}`);

		room.on('trackSubscribed', (t) => {
			addParticipant(t);
		});
		room.on('reconnected', () => { 
			afterRoomChanged(true); 
		});
		room.on('disconnected', (room, error) => {
			afterRoomChanged(false);
			messageElement.html('Disconnected');
			
			if(error != null) {
				if (error.code === 20104) { console.log('Signaling reconnection failed due to expired AccessToken!'); } 
				else if (error.code === 53000) { console.log('Signaling reconnection attempts exhausted!'); } 
				else if (error.code === 53204) { console.log('Signaling reconnection took too long!'); }
			}
		});

		room.participants.forEach(p => {
			addParticipant(p);
			return true;
		});

		afterRoomChanged(true);
	}).catch(reason => {
		console.info(reason);
	});
}

//------------------------------------------------------------------------------------------------------------------
//-- Room Changed

function afterRoomChanged(connected) {
	roomJoined = connected;
	
	if($('#share-video-button > i').hasClass('fa-video')) {
		toggleShareVideoInRoom(false);
	}
	else {
		toggleShareVideoInRoom(true);
	}

	if($('#mute-button > i').hasClass('fa-microphone-alt')) {
		toggleMuteInRoom(false);
	}
	else {
		toggleMuteInRoom(true);
	}

	var button = $('#call-button');
	var icon = $('#i', button);

	var roomElement = $('div#room');
	roomElement.addClass(connected ? 'connected' : 'disconnected');
	roomElement.removeClass(connected ? 'disconnected' : 'connected');
	
	if(connected) {
		if (participantVideo.innerHTML === '') {
			messageElement.html('Waiting on ' + (isPharmacy ? 'patient' : 'clinician') + '...');
		}
		else 
		{
			messageElement.html('');
		}

		icon.removeClass('fa-phone-alt');
		icon.addClass('fa-times');
	}
	else {
		icon.addClass('fa-phone-alt');
		icon.removeClass('fa-times');
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Disconnect Call to Twilio

function disconnectCall() {
	if(room != null) {
		room.disconnect();
	}

	toggleVideoLocation(true, true);
	afterRoomChanged(false);
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
//-- Toggle Mute

function toggleMute() {
	var muteButton = $(this);
	var icon = $('i', muteButton);

	//-- Mute Call
	if(icon.hasClass('fa-microphone-alt')) {
		icon.addClass('fa-microphone-alt-slash');
		icon.removeClass('fa-microphone-alt');
		muteButton.addClass('muted-call');

		toggleMuteInRoom(true);
	}
	//-- Unmute Call
	else {
		icon.removeClass('fa-microphone-alt-slash');
		icon.addClass('fa-microphone-alt');
		muteButton.removeClass('muted-call');

		toggleMuteInRoom(false);
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Toggle Mute In Room

function toggleMuteInRoom(muted) {
	console.log(`toggleMuteInRoom(${muted})`);

	if(room != null && room.localParticipant != null && room.localParticipant.audioTracks != null) {
		console.log('audio track review');

		room.localParticipant.audioTracks.forEach((map) => {
			console.log(`local audio track (${muted})`);

			if(muted) {
				map.track.disable();
			}
			else {
				map.track.enable();
			}
		});
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Toggle Share Video

function toggleShareVideo() {
	var shareVideoButton = $(this);
	var icon = $('i', shareVideoButton);

	//-- Share Video
	if(icon.hasClass('fa-video-slash')) {
		icon.addClass('fa-video');
		icon.removeClass('fa-video-slash');
		shareVideoButton.removeClass('disable-video');

		toggleShareVideoInRoom(false);
	}
	//-- Unshare Call
	else {
		icon.removeClass('fa-video');
		icon.addClass('fa-video-slash');
		shareVideoButton.addClass('disable-video');

		toggleShareVideoInRoom(true);
	}
}

//------------------------------------------------------------------------------------------------------------------
//-- Toggle Video Window

function toggleShareVideoInRoom(disabled) {
	console.log(`toggleShareVideoInRoom(${disabled})`);

	if(room != null && room.localParticipant != null && room.localParticipant.videoTracks != null) {
		console.log('video track review');

		room.localParticipant.videoTracks.forEach((map) => {
			console.log(`local video track (${disabled})`);

			if(disabled) {
				map.track.disable();
			}
			else {
				map.track.enable();
			}
		});
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

	$('#call-button').on('click', () => {
		toggleCall(roomJoined);
	});

	$('#mute-button').click(toggleMute);
	$('#share-video-button').click(toggleShareVideo);
});
