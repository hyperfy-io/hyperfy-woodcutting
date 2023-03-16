# Hyperfy Woodcutting

This repo contains two example apps demonstrating woodcutting that can be used in your Hyperfy world.

## Axe

The Axe can be picked up by players and swung around with sound effects and animation.

## Tree

The Tree when hit by an Axe loses "health" and plays a chopping sound.
When a tree has no more health it plays a falling sound and turns into a stump.
The server then starts a respawn timer.

## Getting Started

- `git clone https://github.com/hyperfy-io/hyperfy-woodcutting.git`
- `cd hyperfy-woodcutting`
- `yarn`
- `yarn dev`
- open `http://localhost:4000` in your browser
- hit `Tab` to open the editor and add WCAxe and WCTree's to the world.
