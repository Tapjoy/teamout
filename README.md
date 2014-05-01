= Hangjoy

Google Hangouts for Teams

== Things to do before open-source

Features:
* Add timestamp to photo
* Theo's photo is skewed (likely different resolution per webcam)
* Firefox requires the following setting: media.navigator.permission.disabled (to be fixed in next version)
* Make busy more obvious (persistent)
* Change Leave button to be on the same row as the conversation
* Change avatar on the bottom to represent the user's snapshot instead of their google+ avatar
* It's not always clear when you're in a video chat

Cleanup tasks:
* Add package builder (with css / js)
* Switch to a layout engine
* Update README

== Deployment

To deploy the application, simply:

```
script/deploy
```