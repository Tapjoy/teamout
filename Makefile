# Default variables
JS_COMPRESSOR ?= ./node_modules/.bin/uglifyjs
CSS_COMPRESSOR ?= ./node_modules/.bin/cleancss
WEBPACK ?= ./node_modules/.bin/webpack
TARGET ?= development
S3_BUCKET ?= teamout

# Asset files
DIST = public
AUDIO = $(shell find app/assets/audio -type f)
FONTS = $(shell find app/assets/fonts -type f)
IMAGES = $(shell find app/assets/images -type f)
CSS = \
	vendor/bootstrap/dist/css/bootstrap.css \
	vendor/bootstrap/dist/css/bootstrap-theme.css \
	vendor/nanoscroller/bin/css/nanoscroller.css \
	app/assets/css/glyphicons.css \
	app/assets/css/main.css
VERSION = development

ifeq ($(TARGET), production)
HOST ?= s3.amazonaws.com\/$(S3_BUCKET)
xml: clean
release: min version
else ifeq ($(TARGET), development)
HOST ?= localhost:3000
endif

all: xml js css media release

clean:
	@rm -rf $(DIST)/*

xml:
	mkdir -p $(DIST)
	cp -p app/main.xml $(DIST)/main.xml

js:
	mkdir -p $(DIST)/assets/js
	$(WEBPACK) --config config/webpack.js

css:
	mkdir -p $(DIST)/assets/css
	cat $(CSS) > $(DIST)/assets/css/main.css

media:
	mkdir -p $(DIST)/assets/audio $(DIST)/assets/fonts $(DIST)/assets/images
	cp -p $(AUDIO) $(DIST)/assets/audio
	cp -p $(FONTS) $(DIST)/assets/fonts
	cp -p $(IMAGES) $(DIST)/assets/images

min:
	$(CSS_COMPRESSOR) $(DIST)/assets/css/main.css -o $(DIST)/assets/css/main.css
	$(JS_COMPRESSOR) $(DIST)/assets/js/main.js -o $(DIST)/assets/js/main.js

version:
	$(eval VERSION := $(shell find $(DIST)/ -type f -exec md5sum {} + | awk '{print $$1}' | sort | md5sum | awk '{print substr($$1, 0, 10)}'))

release:
	sed -i "s/\$$ENV(host)/$(HOST)\/$(VERSION)/g" $(DIST)/main.xml
	mkdir -p $(DIST)/$(VERSION)/assets
	cp -pR $(DIST)/assets/* $(DIST)/$(VERSION)/assets/
	rm -rf $(DIST)/assets

deploy:
	aws s3 sync $(DIST)/ s3://$(S3_BUCKET)/