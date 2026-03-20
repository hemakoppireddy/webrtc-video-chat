"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

let socket: Socket;
const peerConnections: { [id: string]: RTCPeerConnection } = {};

export default function RoomPage() {
  const { roomId } = useParams();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteStreams, setRemoteStreams] = useState<any[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    socket = io("http://localhost:3000");

    // 🎥 Get local media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      });

    socket.on("connect", () => {
      socket.emit("join-room", { roomId });
    });

    // 🔹 Existing users → create offers
    socket.on("existing-users", (users: string[]) => {
      users.forEach(userId => {
        createPeerConnection(userId, true);
      });
    });

    // 🔹 New user joined → wait for offer
    socket.on("user-joined", (userId: string) => {
      createPeerConnection(userId, false);
    });

    // 🔹 Receive offer
    socket.on("offer", async ({ from, offer }) => {
      const pc = createPeerConnection(from, false);
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { to: from, answer });
    });

    // 🔹 Receive answer
    socket.on("answer", async ({ from, answer }) => {
      const pc = peerConnections[from];
      await pc.setRemoteDescription(answer);
    });

    // 🔹 ICE candidates
    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnections[from];
      if (pc) {
        await pc.addIceCandidate(candidate);
      }
    });

    // 🔹 User disconnected
    socket.on("user-disconnected", (userId: string) => {
      if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
      }

      setRemoteStreams(prev => prev.filter(s => s.id !== userId));
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  // 🔥 Create Peer Connection
  const createPeerConnection = (userId: string, isInitiator: boolean) => {
    if (peerConnections[userId]) return peerConnections[userId];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: process.env.NEXT_PUBLIC_STUN_SERVER || "stun:stun.l.google.com:19302" }
      ]
    });

    peerConnections[userId] = pc;

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];

      setRemoteStreams(prev => {
        if (prev.find(s => s.id === userId)) return prev;
        return [...prev, { id: userId, stream }];
      });
    };

    // ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: userId,
          candidate: event.candidate
        });
      }
    };

    // Create offer if initiator
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit("offer", {
            to: userId,
            offer: pc.localDescription
          });
        });
    }

    return pc;
  };

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Room: {roomId}</h1>

      {/* Local Video */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-64 mb-4 border"
        data-test-id="local-video"
      />

      {/* Remote Videos */}
      <div
        className="grid grid-cols-2 gap-4"
        data-test-id="remote-video-container"
      >
        {remoteStreams.map((remote) => (
          <video
            key={remote.id}
            autoPlay
            playsInline
            className="w-64 border"
            ref={(video) => {
              if (video) video.srcObject = remote.stream;
            }}
          />
        ))}
      </div>
    </div>
  );
}