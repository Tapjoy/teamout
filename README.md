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

Today:
* Settings: Select media devices
* Not everyone's hanging_with gets updated
* Refactor: Clean up application.js and element names / css

Future:
* Integrate Flowdock
* Convert into a full application

== Deployment

To deploy the application, simply:

```
git remote add git@heroku.com:hangjoy.git
git push heroku master
```