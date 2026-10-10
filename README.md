# alltag

Learn a language from the room you are in.

## What it is
Point the camera at a room, get the French words for what is in it, then talk through a short roleplay with Noé, the tutor.

## Why
Learners stall on words they never use in their own surroundings; no current app ties vision, live conversation and spaced review together.

## Setup
Run `pnpm i`, copy `.env.example` to `.env` and fill `GEMINI_API_KEY` and `GRADIUM_API_KEY`, then `pnpm dev` locally or `vercel deploy`.

## Architecture
A Vite + React client talks to Vercel functions under `api/`, with dialogue and corrections as two separate Gemini calls.

## API
Every endpoint under `api/` with its request and response schema is listed here.

## Partner tech
Gradium for speech in and out, Google Gemini for vision, dialogue and corrections, Entire for recording the build sessions.

## Latency
Real numbers measured on the venue wifi go here.

## Learning design
Level control, the correction taxonomy, spaced repetition and the camera recall trigger.

## Entire
A human runs `entire enable` in this repo to capture the agent sessions behind each commit; the checkpoints branch link goes here.

## What we did not build
The features we left out and why.

## Team, licence
Team members and the licence.
