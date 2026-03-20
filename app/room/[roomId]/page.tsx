"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

let socket: Socket;
const peerConnections: { [id: string]: RTCPeerConnection } = {};

export default function RoomPage() {
  const { roomId } = useParams();
  const router = useRouter();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [remoteStreams, setRemoteStreams] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [status, setStatus] = useState("waiting");

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

    // 🔹 Existing users
    socket.on("existing-users", (users: string[]) => {
      if (users.length > 0) setStatus("connecting");

      users.forEach(userId => {
        createPeerConnection(userId, true);
      });
    });

    // 🔹 New user joined
    socket.on("user-joined", (userId: string) => {
      setStatus("connecting");
      createPeerConnection(userId, false);
    });

    // 🔹 Offer
    socket.on("offer", async ({ from, offer }) => {
      const pc = createPeerConnection(from, false);
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { to: from, answer });
    });

    // 🔹 Answer
    socket.on("answer", async ({ from, answer }) => {
      const pc = peerConnections[from];
      await pc.setRemoteDescription(answer);
    });

    // 🔹 ICE
    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnections[from];
      if (pc) {
        await pc.addIceCandidate(candidate);
      }
    });

    // 🔹 Disconnect
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

  // 🔥 Peer Connection
  const createPeerConnection = (userId: string, isInitiator: boolean) => {
    if (peerConnections[userId]) return peerConnections[userId];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: process.env.NEXT_PUBLIC_STUN_SERVER || "stun:stun.l.google.com:19302" }
      ]
    });

    peerConnections[userId] = pc;

    // Add tracks
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // Remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];

      setStatus("connected");

      setRemoteStreams(prev => {
        if (prev.find(s => s.id === userId)) return prev;
        return [...prev, { id: userId, stream }];
      });
    };

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: userId,
          candidate: event.candidate
        });
      }
    };

    // Offer
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

  // 🔇 MIC
  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    stream.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });

    setIsMuted(prev => !prev);
  };

  // 📷 CAMERA
  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    stream.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });

    setIsCameraOff(prev => !prev);
  };

  // 🔴 HANGUP
  const handleHangup = () => {
    Object.values(peerConnections).forEach(pc => pc.close());

    localStreamRef.current?.getTracks().forEach(track => track.stop());

    socket.disconnect();

    router.push("/");
  };

  return (
    <div className="p-4">

      <h1 className="text-xl mb-4">Room: {roomId}</h1>

      {/* STATUS */}
      <div className="mb-4">
        {status === "waiting" && (
          <p data-test-id="status-waiting">Waiting for others...</p>
        )}
        {status === "connecting" && (
          <p data-test-id="status-connecting">Connecting...</p>
        )}
        {status === "connected" && (
          <p data-test-id="status-connected">Connected</p>
        )}
      </div>

      {/* LOCAL VIDEO */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-64 mb-4 border"
        data-test-id="local-video"
      />

      {/* REMOTE VIDEOS */}
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

      {/* CONTROLS */}
      <div className="flex gap-4 mt-4">

        <button
          onClick={toggleMic}
          data-test-id="mute-mic-button"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {isMuted ? "Unmute Mic" : "Mute Mic"}
        </button>

        <button
          onClick={toggleCamera}
          data-test-id="toggle-camera-button"
          className="px-4 py-2 bg-yellow-500 text-white rounded"
        >
          {isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
        </button>

        <button
          onClick={handleHangup}
          data-test-id="hangup-button"
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Hang Up
        </button>

      </div>

    </div>
  );
}