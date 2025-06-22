import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://192.168.157.1:3000",
    "https://5d8c-2400-adc5-12d-9100-2c8e-efba-ae84-72f1.ngrok-free.app",
  ],
};

export default nextConfig;
