= Hangjoy

Push to video-talk for Google Hangouts (+ eventually rich media chat)

== Application code

The main application code is located under assets/app.xml.  This is the opensocial gadget configuration that will get loaded by Google Hangouts.

The actual application logic itself is located under assets/js/application.js.

== Getting started

In order to access this Google Hangout extension, you must be invited to be a collaborator on the extension within the Google Apps console.  This is because the extension is not yet available to the public.

Once invited, you should be able to access it from any hangout.

== Things to do

* Prepare demo / presentation
* Settings: Select media devices
* Integrate Flowdock
* Convert into a full application

== Deployment

To deploy the application, simply:

```
git remote add git@heroku.com:hangjoy.git
git push heroku master
```