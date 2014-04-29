= Hangjoy

Push to video-talk for Google Hangouts (+ eventually rich media chat)

== Things to do before open-source

* Add page for accessing rooms
* Add package builder (with css / js)
* Switch hostname to be environment-specific
* Publish to public
* Update README

== Deployment

To deploy the application, simply:

```
script/deploy

```

```html
<script type="text/javascript" src="//apis.google.com/js/platform.js"></script>
<script>
gapi.hangout.render('placeholder-div', {render: 'createhangout'});
</script>
```