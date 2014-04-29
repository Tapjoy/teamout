= Hangjoy

Push to video-talk for Google Hangouts (+ eventually rich media chat)

== Application code

The main application code is located under assets/app.xml.  This is the opensocial gadget configuration that will get loaded by Google Hangouts.

The actual application logic itself is located under assets/js/application.js.

== Getting started

In order to access this Google Hangout extension, you must be invited to be a collaborator on the extension within the Google Apps console.  This is because the extension is not yet available to the public.

Once invited, you should be able to access it from any hangout.

To invite:

* Add member to https://console.developers.google.com/project/apps~hopeful-theorem-553/permissions
* Member needs to accept *both* permission

== Things to do

* Add a "I'm busy" mode (where audio / video doesn't start, user is marked as busy)

* Add package builder (with css / js)
* Update README

== Deployment

To deploy the application, simply:

```
script/deploy

```