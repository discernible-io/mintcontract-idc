import React from "react";
import safe from "../assets/safe.png";

export const RODITset = ({ tx }) => {
  return (
    <div className="max-w-sm mt-12 bg-slate-100 border border-gray-200 rounded-lg shadow-md overflow-hidden">
      <div className="h-48">
        <img className="w-full h-full object-cover" src={safe} alt="Safe icon" />
      </div>
      <div className="p-5">
        <h2 className="mb-4 text-2xl font-bold tracking-wide text-gray-900">
          Portal and Sanctum pair minted! Please move the Portal RODiT (second minted) to the Portal account ID
        </h2>
        <a 
          href={tx} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-block w-full"
        >
          <button className="w-full rounded-xl bg-indigo-700 px-4 py-3 text-white shadow-lg transition duration-300 ease-in-out hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50">
            Check the RODiT request on blockchain
          </button>
        </a>
      </div>
    </div>
  );
};