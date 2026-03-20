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

  //  Chat state
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<{ from: string; message: string }[]>([]);

  useEffect(() => {
    socket = io("http://localhost:3000");

    //  Media
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

    socket.on("existing-users", (users: string[]) => {
      if (users.length > 0) setStatus("connecting");
      users.forEach(userId => createPeerConnection(userId, true));
    });

    socket.on("user-joined", (userId: string) => {
      setStatus("connecting");
      createPeerConnection(userId, false);
    });

    socket.on("offer", async ({ from, offer }) => {
      const pc = createPeerConnection(from, false);
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { to: from, answer });
    });

    socket.on("answer", async ({ from, answer }) => {
      await peerConnections[from].setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      await peerConnections[from]?.addIceCandidate(candidate);
    });

    socket.on("user-disconnected", (userId: string) => {
      peerConnections[userId]?.close();
      delete peerConnections[userId];
      setRemoteStreams(prev => prev.filter(s => s.id !== userId));
    });

    //  Receive message
    socket.on("chat-message", ({ from, message }) => {
      setChatLog(prev => [...prev, { from, message }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  //  Peer
  const createPeerConnection = (userId: string, isInitiator: boolean) => {
    if (peerConnections[userId]) return peerConnections[userId];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: process.env.NEXT_PUBLIC_STUN_SERVER || "stun:stun.l.google.com:19302" }
      ]
    });

    peerConnections[userId] = pc;

    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = (event) => {
      setStatus("connected");

      const stream = event.streams[0];
      setRemoteStreams(prev => {
        if (prev.find(s => s.id === userId)) return prev;
        return [...prev, { id: userId, stream }];
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: userId, candidate: event.candidate });
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => {
          socket.emit("offer", { to: userId, offer: pc.localDescription });
        });
    }

    return pc;
  };

  //  Mic
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    setIsMuted(prev => !prev);
  };

  // Camera
  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    setIsCameraOff(prev => !prev);
  };

  //  Hangup
  const handleHangup = () => {
    Object.values(peerConnections).forEach(pc => pc.close());
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    socket.disconnect();
    router.push("/");
  };

  //  Send message
  const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("chat-message", { roomId, message });

    setChatLog(prev => [...prev, { from: "You", message }]);
    setMessage("");
  };

  return (
    <div className="p-4">

      <h1 className="text-xl mb-4">Room: {roomId}</h1>

      {/* STATUS */}
      <div className="mb-4">
        {status === "waiting" && <p data-test-id="status-waiting">Waiting...</p>}
        {status === "connecting" && <p data-test-id="status-connecting">Connecting...</p>}
        {status === "connected" && <p data-test-id="status-connected">Connected</p>}
      </div>

      {/* LOCAL */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-64 mb-4 border"
        data-test-id="local-video"
      />

      {/* REMOTE */}
      <div className="grid grid-cols-2 gap-4 mb-4" data-test-id="remote-video-container">
        {remoteStreams.map((r) => (
          <video
            key={r.id}
            autoPlay
            playsInline
            className="w-64 border"
            ref={(v) => { if (v) v.srcObject = r.stream; }}
          />
        ))}
      </div>

      {/* CONTROLS */}
      <div className="flex gap-4 mb-4">
        <button data-test-id="mute-mic-button" onClick={toggleMic} className="bg-blue-500 px-4 py-2 text-white rounded">
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button data-test-id="toggle-camera-button" onClick={toggleCamera} className="bg-yellow-500 px-4 py-2 text-white rounded">
          {isCameraOff ? "Camera On" : "Camera Off"}
        </button>

        <button data-test-id="hangup-button" onClick={handleHangup} className="bg-red-500 px-4 py-2 text-white rounded">
          Hangup
        </button>
      </div>

      {/* CHAT */}
      <div className="border p-3 w-80">

        <div className="h-40 overflow-y-auto mb-2" data-test-id="chat-log">
          {chatLog.map((msg, i) => (
            <div key={i} data-test-id="chat-message">
              <strong>{msg.from}: </strong>{msg.message}
            </div>
          ))}
        </div>

        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type message..."
          data-test-id="chat-input"
          className="border p-1 w-full mb-2"
        />

        <button
          onClick={sendMessage}
          data-test-id="chat-submit"
          className="bg-green-500 text-white px-3 py-1 w-full"
        >
          Send
        </button>

      </div>

    </div>
  );
}