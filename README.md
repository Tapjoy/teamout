# Hangjoy

Google Hangouts for Teams

## Things to do before open-source

Changes:
 * Change Leave button to be on the same row as the conversation
 * Add help menu

Cleanup tasks:
 * Update README

## Setup

```
sudo apt-get install rpm
npm install
```

## Deployment

To deploy the application for development:

```
make all
```

To deploy the application in production:

```
TARGET=production make all deploy
```