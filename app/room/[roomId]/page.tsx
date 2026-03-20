"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

let socket: Socket;

export default function RoomPage() {
  const { roomId } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 1. Connect to socket
    socket = io("http://localhost:3000");

    socket.on("connect", () => {
      console.log("Connected:", socket.id);

      // 2. Join room
      socket.emit("join-room", { roomId });
    });

    // 3. Get user media
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Media error:", err);
      });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-xl font-bold mb-4">Room: {roomId}</h1>

      {/* Local Video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-96 border rounded"
        data-test-id="local-video"
      />
    </div>
  );
}