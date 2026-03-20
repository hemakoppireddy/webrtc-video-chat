# WebRTC Video Chat Application

## Overview

This project is a production-ready multi-peer video chat application built using Next.js, TypeScript, WebRTC, and Socket.IO. It enables real-time peer-to-peer video and audio communication directly in the browser, along with a text-based chat system and in-call controls.

The application uses a custom WebSocket signaling server to establish WebRTC connections and supports multiple participants using a mesh topology.

---

## Features

* Real-time video and audio communication using WebRTC
* Multi-peer mesh topology (supports up to 4 participants)
* Dynamic room-based communication using unique room IDs
* Real-time text chat between participants
* Microphone mute/unmute functionality
* Camera on/off toggle
* Call termination with full resource cleanup
* Connection status indicators (waiting, connecting, connected)
* Automatic handling of peer disconnections
* Fully containerized using Docker

---

## Tech Stack

* Next.js (App Router)
* TypeScript
* WebRTC (RTCPeerConnection, ICE candidates)
* Socket.IO (WebSocket signaling)
* Tailwind CSS
* Docker and Docker Compose

---

## Architecture

The application follows a client-server architecture:

* The frontend is built with Next.js and handles UI rendering and WebRTC peer connections.
* A custom Node.js server integrates Next.js with Socket.IO for signaling.
* WebRTC is used for direct peer-to-peer media streaming.
* Socket.IO is used for signaling, room management, and chat messaging.

The application uses a mesh topology where each participant establishes a direct connection with every other participant.

---

## Getting Started

### Prerequisites

* Node.js (version 20 or higher)
* Docker and Docker Compose (for containerized setup)

---

## Running the Application

### Using Docker (Recommended)

Run the following command from the project root:

```bash
docker-compose up --build
```

After the containers start, open:
http://localhost:3000

---

### Manual Setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:
http://localhost:3000

---

## Environment Variables

The application uses the following environment variables:

```
PORT=3000
NEXT_PUBLIC_STUN_SERVER=stun:stun.l.google.com:19302
```

Refer to the `.env.example` file for details.

---

## Health Check

The application includes a health check endpoint:

```
/api/health
```

This endpoint is used by Docker to verify that the application is running.

---

## Testing the Application

1. Open the application in a browser:
   http://localhost:3000/room/test123

2. Open the same URL in multiple tabs or browser windows.

3. Grant camera and microphone permissions.

4. Verify:

   * Video streams are visible across all participants
   * Chat messages are synchronized in real time
   * Controls (mute, camera toggle, hangup) function correctly

---

## Project Structure

```
src/
  app/
    api/health/
    room/[roomId]/
server.ts
Dockerfile
docker-compose.yml
.env.example
README.md
```

---

## Notes

* A public STUN server is used for NAT traversal.
* TURN servers are not required for this implementation.
* The mesh topology is suitable for small group calls (up to 4 participants).
* For larger scale systems, SFU or MCU architectures are recommended.

---
