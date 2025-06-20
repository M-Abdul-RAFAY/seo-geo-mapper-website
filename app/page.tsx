"use client";
import React, { useState, useCallback, useMemo } from "react";
import {
  MapPin,
  Download,
  Settings,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
} from "lucide-react";

const GeoBusinessLocator = () => {
  // State management
  const [centerLat, setCenterLat] = useState("");
  const [centerLon, setCenterLon] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");
  const [businessNames, setBusinessNames] = useState(["Petey's HVAC"]);
  const [keywords, setKeywords] = useState([
    "Air Conditioning Contractors",
    "Air Conditioning Repair",
  ]);
  const [descriptions, setDescriptions] = useState([
    "Professional air conditioning contractors offering expert AC installation, repair, and maintenance services for homes and businesses.",
    "Get fast, reliable air conditioning repair from certified HVAC technicians. We service all major AC brands.",
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("config");

  // Form states for adding new items
  const [newKeyword, setNewKeyword] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");

  // Configuration
  const config = useMemo(
    () => ({
      totalPoints: 360,
      numDiscs: 5,
      radiusIncrementMiles: 2.0,
      colorPalette: [
        "red",
        "blue",
        "green",
        "orange",
        "purple",
        "black",
        "gray",
        "pink",
        "cyan",
        "yellow",
      ],
    }),
    []
  );

  // Google Geocoding API function
  const getCityFromCoordinates = useCallback(async (lat, lon) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw new Error("Google Maps API key not found");
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        const addressComponents = result.address_components;

        let city = "";
        let state = "";

        // Extract city and state from address components
        for (const component of addressComponents) {
          if (component.types.includes("locality")) {
            city = component.long_name;
          } else if (component.types.includes("administrative_area_level_1")) {
            state = component.short_name;
          }
        }

        // Fallback to other locality types
        if (!city) {
          for (const component of addressComponents) {
            if (
              component.types.includes("sublocality") ||
              component.types.includes("neighborhood") ||
              component.types.includes("administrative_area_level_2")
            ) {
              city = component.long_name;
              break;
            }
          }
        }

        return city && state ? `${city}, ${state}` : "Unknown Location";
      } else {
        console.warn(`Geocoding failed for ${lat}, ${lon}:`, data.status);
        return "Unknown Location";
      }
    } catch (error) {
      console.error(`Geocoding error for ${lat}, ${lon}:`, error);
      return "Unknown Location";
    }
  }, []);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Generate circular points around center
  const generateCircularPoints = useCallback(
    (centerLat, centerLon, radiusMiles, numPoints) => {
      const points = [];

      for (let i = 0; i < numPoints; i++) {
        const angle = (2 * Math.PI * i) / numPoints;

        // Convert miles to degrees (approximate)
        const latOffset = (radiusMiles / 69) * Math.cos(angle);
        const lonOffset =
          (radiusMiles / (69 * Math.cos((centerLat * Math.PI) / 180))) *
          Math.sin(angle);

        const newLat = centerLat + latOffset;
        const newLon = centerLon + lonOffset;

        points.push({ latitude: newLat, longitude: newLon });
      }

      return points;
    },
    []
  );

  // Add/Remove functions for dynamic lists
  const addKeyword = () => {
    if (newKeyword.trim()) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (index) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const addDescription = () => {
    if (newDescription.trim()) {
      setDescriptions([...descriptions, newDescription.trim()]);
      setNewDescription("");
    }
  };

  const removeDescription = (index) => {
    setDescriptions(descriptions.filter((_, i) => i !== index));
  };

  const addBusinessName = () => {
    if (newBusinessName.trim()) {
      setBusinessNames([...businessNames, newBusinessName.trim()]);
      setNewBusinessName("");
    }
  };

  const removeBusinessName = (index) => {
    setBusinessNames(businessNames.filter((_, i) => i !== index));
  };

  // Process all points
  const processPoints = useCallback(async () => {
    const lat = parseFloat(centerLat);
    const lon = parseFloat(centerLon);

    if (isNaN(lat) || isNaN(lon)) {
      setError("Please enter valid coordinates");
      return;
    }

    if (keywords.length === 0) {
      setError("Please add at least one keyword");
      return;
    }

    if (descriptions.length === 0) {
      setError("Please add at least one description");
      return;
    }

    if (businessNames.length === 0) {
      setError("Please add at least one business name");
      return;
    }

    setIsProcessing(true);
    setError("");
    setProgress(0);
    setStatus("Generating points...");

    try {
      const allPoints = [];
      const pointsPerDisc = Math.floor(config.totalPoints / config.numDiscs);

      // Add center point
      allPoints.push({
        latitude: lat,
        longitude: lon,
        discNumber: 0,
        radiusMiles: 0,
        pointIndex: 0,
      });

      // Generate points for each disc
      let pointCounter = 1;
      for (let disc = 1; disc <= config.numDiscs; disc++) {
        const radius = disc * config.radiusIncrementMiles;
        const discPoints = generateCircularPoints(
          lat,
          lon,
          radius,
          pointsPerDisc
        );

        discPoints.forEach((point) => {
          allPoints.push({
            ...point,
            discNumber: disc,
            radiusMiles: radius,
            pointIndex: pointCounter++,
          });
        });
      }

      setStatus("Geocoding locations...");
      const processedResults = [];

      // Process points in smaller batches to avoid API rate limits
      const batchSize = 5; // Reduced batch size for Google API
      for (let i = 0; i < allPoints.length; i += batchSize) {
        const batch = allPoints.slice(i, i + batchSize);
        const batchPromises = batch.map(async (point) => {
          const cityState = await getCityFromCoordinates(
            point.latitude,
            point.longitude
          );

          const baseKeyword = keywords[point.pointIndex % keywords.length];
          const keyword = `${baseKeyword} ${cityState}`;

          const baseBusiness =
            businessNames[point.pointIndex % businessNames.length];
          const businessName = `${baseBusiness} ${cityState}`;

          const description =
            descriptions[point.pointIndex % descriptions.length];
          const color =
            config.colorPalette[
              (point.discNumber - 1) % config.colorPalette.length
            ] || "black";

          return {
            latitude: point.latitude.toFixed(6),
            longitude: point.longitude.toFixed(6),
            cityState,
            keyword,
            businessName,
            description,
            color,
            discNumber: point.discNumber,
            radiusMiles: point.radiusMiles,
            businessUrl: businessUrl || "N/A",
          };
        });

        const batchResults = await Promise.all(batchPromises);
        processedResults.push(...batchResults);

        // Update progress
        const progressPercent = Math.min(
          100,
          (processedResults.length / allPoints.length) * 100
        );
        setProgress(progressPercent);
        setStatus(
          `Processed ${processedResults.length} of ${allPoints.length} locations...`
        );

        // Add delay between batches to respect API rate limits
        if (i + batchSize < allPoints.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      setResults(processedResults);
      setStatus("Processing complete!");
      setProgress(100);
    } catch (err) {
      setError(`Processing failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [
    centerLat,
    centerLon,
    businessUrl,
    config,
    keywords,
    descriptions,
    businessNames,
    generateCircularPoints,
    getCityFromCoordinates,
  ]);

  // Export to CSV
  const exportToCSV = useCallback((data, filename) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((header) => `"${row[header]}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }, []);

  const handleExportMain = () =>
    exportToCSV(results, "geo_business_locations_comprehensive.csv");

  const handleExportBusiness = () => {
    const businessData = results.map(
      ({
        businessName,
        cityState,
        latitude,
        longitude,
        keyword,
        businessUrl,
        discNumber,
        radiusMiles,
      }) => ({
        businessName,
        cityState,
        latitude,
        longitude,
        keyword,
        businessUrl,
        discNumber,
        radiusMiles,
      })
    );
    exportToCSV(businessData, "business_locations_only.csv");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <MapPin className="text-blue-600" size={40} />
            Geo Business Locator
          </h1>
          <p className="text-gray-900">
            Generate circular business location patterns with dynamic keywords
            and descriptions
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("config")}
              className={`px-6 py-3 font-medium ${
                activeTab === "config"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-900"
              }`}
            >
              <Settings className="inline mr-2" size={16} />
              Configuration
            </button>
            <button
              onClick={() => setActiveTab("keywords")}
              className={`px-6 py-3 font-medium ${
                activeTab === "keywords"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-900"
              }`}
            >
              <Edit3 className="inline mr-2" size={16} />
              Keywords & Content
            </button>
          </div>

          <div className="p-6">
            {/* Configuration Tab */}
            {activeTab === "config" && (
              <div>
                <h2 className="text-xl text-gray-800 font-semibold mb-4">
                  Location & Business Settings
                </h2>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Center Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={centerLat}
                      onChange={(e) => setCenterLat(e.target.value)}
                      placeholder="e.g., 42.1103"
                      className="w-full px-3 text-gray-900 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isProcessing}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Center Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={centerLon}
                      onChange={(e) => setCenterLon(e.target.value)}
                      placeholder="e.g., -88.2073"
                      className="w-full px-3 text-gray-900 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Website URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={businessUrl}
                    onChange={(e) => setBusinessUrl(e.target.value)}
                    placeholder="https://your-business.com"
                    className="w-full px-3 text-gray-900 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isProcessing}
                  />
                </div>

                {/* Configuration Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-2">
                    Current Settings:
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-900">
                    <div>
                      <span className="font-medium">Total Points:</span>{" "}
                      {config.totalPoints + 1}
                    </div>
                    <div>
                      <span className="font-medium">Discs:</span>{" "}
                      {config.numDiscs}
                    </div>
                    <div>
                      <span className="font-medium">Radius Step:</span>{" "}
                      {config.radiusIncrementMiles} miles
                    </div>
                    <div>
                      <span className="font-medium">Max Radius:</span>{" "}
                      {config.numDiscs * config.radiusIncrementMiles} miles
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Keywords & Content Tab */}
            {activeTab === "keywords" && (
              <div className="space-y-6">
                {/* Business Names Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Business Names ({businessNames.length})
                  </h3>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newBusinessName}
                      onChange={(e) => setNewBusinessName(e.target.value)}
                      placeholder="Enter business name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      onKeyPress={(e) => e.key === "Enter" && addBusinessName()}
                    />
                    <button
                      onClick={addBusinessName}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-1"
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2 text-gray-900 max-h-32 overflow-y-auto">
                    {businessNames.map((name, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                      >
                        <span className="text-sm">{name}</span>
                        <button
                          onClick={() => removeBusinessName(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Keywords Section - CSV Input */}
                <div>
                  <h3 className="text-lg text-gray-900 font-semibold mb-3">
                    Keywords (CSV)
                  </h3>
                  <div className="flex gap-2 mb-3">
                    <textarea
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="Enter keywords as CSV, e.g. Keyword1, Keyword2"
                      rows={3}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                    />
                    <button
                      onClick={() => {
                        if (newKeyword.trim()) {
                          const arr = newKeyword
                            .split(",")
                            .map((k) => k.trim())
                            .filter((k) => k.length > 0);
                          if (arr.length > 0) {
                            setKeywords(arr);
                            setNewKeyword(arr.join("\n")); // Show each entry on a new line
                            setError("");
                          } else {
                            setError("Input must contain at least one keyword");
                          }
                        } else {
                          setError("Input cannot be empty");
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-1 self-start"
                    >
                      Format CSV
                    </button>
                  </div>
                  <div className="space-y-2 text-gray-900 max-h-32 overflow-y-auto">
                    {keywords.map((keyword, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                      >
                        <span className="text-sm font-mono">{keyword}</span>
                        <button
                          onClick={() => removeKeyword(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Descriptions Section - CSV Input */}
                <div>
                  <h3 className="text-lg text-gray-900 font-semibold mb-3">
                    Descriptions (CSV)
                  </h3>
                  <div className="flex gap-2 mb-3">
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Enter descriptions as CSV, e.g. Description1, Description2"
                      rows={3}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-mono"
                    />
                    <button
                      onClick={() => {
                        if (newDescription.trim()) {
                          const arr = newDescription
                            .split(",")
                            .map((d) => d.trim())
                            .filter((d) => d.length > 0);
                          if (arr.length > 0) {
                            setDescriptions(arr);
                            setNewDescription(arr.join("\n")); // Show each entry on a new line
                            setError("");
                          } else {
                            setError(
                              "Input must contain at least one description"
                            );
                          }
                        } else {
                          setError("Input cannot be empty");
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-1 self-start"
                    >
                      Format CSV
                    </button>
                  </div>
                  <div className="space-y-2 text-gray-900 max-h-40 overflow-y-auto">
                    {descriptions.map((desc, index) => (
                      <div
                        key={index}
                        className="flex items-start justify-between bg-gray-50 px-3 py-2 rounded"
                      >
                        <span className="text-sm flex-1 mr-2 font-mono">
                          {desc}
                        </span>
                        <button
                          onClick={() => removeDescription(index)}
                          className="text-red-600 hover:text-red-800 flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className="mt-6">
              <button
                onClick={processPoints}
                disabled={
                  !centerLat ||
                  !centerLon ||
                  isProcessing ||
                  keywords.length === 0 ||
                  descriptions.length === 0 ||
                  businessNames.length === 0
                }
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play size={20} />
                    Generate Locations
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Progress and Status */}
        {(isProcessing || status) && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="font-semibold mb-4">Progress</h3>
            <div className="mb-2">
              <div className="flex justify-between text-sm text-gray-900 mb-1">
                <span>{status}</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                Results ({results.length} locations)
              </h2>

              <div className="flex gap-2">
                <button
                  onClick={handleExportMain}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                >
                  <Download size={16} />
                  Export All
                </button>
                <button
                  onClick={handleExportBusiness}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                >
                  <Download size={16} />
                  Business Only
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {results.length}
                </div>
                <div className="text-sm text-gray-900">Total Locations</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {new Set(results.map((r) => r.cityState)).size}
                </div>
                <div className="text-sm text-gray-900">Cities Covered</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {config.numDiscs}
                </div>
                <div className="text-sm text-gray-900">Radius Discs</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {config.numDiscs * config.radiusIncrementMiles}
                </div>
                <div className="text-sm text-gray-900">Max Radius (mi)</div>
              </div>
            </div>

            {/* Sample Results Table */}
            <div className="overflow-x-auto">
              <h3 className="font-medium mb-2">Sample Results Preview:</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Business Name</th>
                    <th className="px-4 py-2 text-left">Location</th>
                    <th className="px-4 py-2 text-left">Keyword</th>
                    <th className="px-4 py-2 text-left">Coordinates</th>
                    <th className="px-4 py-2 text-left">Disc</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 10).map((result, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">{result.businessName}</td>
                      <td className="px-4 py-2">{result.cityState}</td>
                      <td className="px-4 py-2 text-xs">{result.keyword}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {result.latitude}, {result.longitude}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className="px-2 py-1 rounded text-white text-xs"
                          style={{ backgroundColor: result.color }}
                        >
                          {result.discNumber}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.length > 10 && (
                <p className="text-sm text-gray-900 mt-2">
                  Showing 10 of {results.length} results. Export to see all
                  data.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeoBusinessLocator;
