import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [url, setUrl] = useState("");
  const [response, setResponse] = useState(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const res = await axios.post("http://localhost:8000/generate", {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      url,
    });
    setResponse(res.data);
  };

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Fast Geo Business Locator 🌍</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Latitude"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="border w-full p-2"
        />
        <input
          type="text"
          placeholder="Longitude"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          className="border w-full p-2"
        />
        <input
          type="text"
          placeholder="Business URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border w-full p-2"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2">
          Generate
        </button>
      </form>

      {response && (
        <div className="mt-6">
          <p>✅ {response.message}</p>
          <p>📊 {response.points} points generated.</p>
          <p>📋 Sample: </p>
          <pre className="bg-gray-100 p-2 mt-2 text-sm">
            {JSON.stringify(response.sample, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}
