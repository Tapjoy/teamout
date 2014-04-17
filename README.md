Notes:

1. Disable Hangouts video
2. Start WebRTC video
3. Take snapshot
4. Enable Hangouts video
===

1. Integrate flowdock message chat
2. Push API for chat
3. Take snapshots with video API
4. Display / hide participants
5. control audio / video mute (locally and remote)

var stream = null;
navigator.mozGetUserMedia({ "video": true }, function(s) {stream = s}, function() {alert(2)});

stream.stop()

navigator.mozGetUserMedia

== Deployment

scripts/deploy