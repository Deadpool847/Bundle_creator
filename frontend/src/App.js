import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import BundleCreator from "./components/BundleCreator";
import Dashboard from "./components/Dashboard";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BundleCreator />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster 
        position="top-right" 
        richColors 
        theme="dark"
        className="toaster group"
        toastOptions={{
          classNames: {
            toast: "group toast glass-effect border-0 text-slate-200",
            description: "group-[.toast]:text-slate-400",
            actionButton: "group-[.toast]:bg-blue-500 group-[.toast]:text-white",
            cancelButton: "group-[.toast]:bg-slate-600 group-[.toast]:text-slate-200",
          },
        }}
      />
    </div>
  );
}

export default App;