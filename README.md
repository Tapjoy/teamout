Notes:

TODO:
* Fix SSL issue
* Invite organization
* Prepare demo / presentation
* Add listeners to prevent users from changing mute when not in a conversation

var stream = null;
navigator.mozGetUserMedia({ "video": true }, function(s) {stream = s}, function() {alert(2)});

stream.stop()

navigator.mozGetUserMedia

== Deployment

scripts/deploy