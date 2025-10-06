import React, { useState, useRef, useCallback } from "react";
import { Upload, Image as ImageIcon, Zap, Download, CheckCircle, AlertCircle, Music, Video } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PLATFORM_OPTIONS = [
  { id: 'redbubble', name: 'Redbubble', description: 'T-shirts, stickers, art prints', color: 'bg-red-500' },
  { id: 'teepublic', name: 'TeePublic', description: 'Apparel and accessories', color: 'bg-green-500' },
  { id: 'threadless', name: 'Threadless', description: 'Community-driven designs', color: 'bg-blue-500' },
  { id: 'zazzle', name: 'Zazzle', description: 'Custom products', color: 'bg-purple-500' },
  { id: 'displate', name: 'Displate', description: 'Metal posters', color: 'bg-gray-500' },
  { id: 'etsy', name: 'Etsy', description: 'Handmade marketplace', color: 'bg-orange-500' },
  { id: 'mobile_wallpapers', name: 'Mobile Wallpapers', description: 'HD, QHD, UHD formats', color: 'bg-indigo-500' },
  { id: 'desktop_wallpapers', name: 'Desktop Wallpapers', description: 'FHD, QHD, 4K formats', color: 'bg-cyan-500' }
];

const BundleCreator = () => {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [customKeywords, setCustomKeywords] = useState("");
  const [images, setImages] = useState([]);
  const [musicFile, setMusicFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProject, setCurrentProject] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef(null);
  const musicInputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      handleImageFiles(imageFiles);
    } else {
      toast.error("Please drop only image files");
    }
  }, []);

  const handleImageFiles = (files) => {
    const newImages = files.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    }));
    
    setImages(prev => [...prev, ...newImages]);
    toast.success(`Added ${files.length} image(s)`);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleImageFiles(files);
    }
  };

  const handleMusicSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setMusicFile(file);
        toast.success("Music file added");
      } else {
        toast.error("Please select an audio file");
      }
    }
  };

  const togglePlatform = (platformId) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const removeImage = (imageId) => {
    setImages(prev => {
      const imageToRemove = prev.find(img => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter(img => img.id !== imageId);
    });
  };

  const createBundle = async () => {
    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    
    if (images.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }
    
    if (selectedPlatforms.length === 0) {
      toast.error("Please select at least one platform");
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      // Create project
      const projectData = {
        name: projectName,
        description: description || `${projectName} digital bundle`,
        platforms: selectedPlatforms,
        custom_keywords: customKeywords.split(',').map(k => k.trim()).filter(k => k)
      };

      const projectResponse = await axios.post(`${API}/bundles/create`, projectData);
      const project = projectResponse.data;
      setCurrentProject(project);
      setProgress(30);

      // Process images and create bundle
      const formData = new FormData();
      images.forEach(image => {
        formData.append('images', image.file);
      });
      
      if (musicFile) {
        formData.append('music', musicFile);
      }

      setProgress(50);
      toast.info("Processing images and creating bundle...", { duration: 3000 });

      const processResponse = await axios.post(
        `${API}/bundles/${project.id}/process`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          responseType: 'blob',
          onUploadProgress: (progressEvent) => {
            const uploadPercent = Math.round(
              (progressEvent.loaded * 40) / progressEvent.total
            );
            setProgress(50 + uploadPercent);
          }
        }
      );

      setProgress(100);

      // Create download link
      const blob = new Blob([processResponse.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${projectName}_bundle.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Bundle created successfully! Download started.");
      
      // Reset form
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        resetForm();
      }, 2000);

    } catch (error) {
      console.error('Bundle creation error:', error);
      setIsProcessing(false);
      setProgress(0);
      toast.error("Failed to create bundle. Please try again.");
    }
  };

  const resetForm = () => {
    setProjectName("");
    setDescription("");
    setSelectedPlatforms([]);
    setCustomKeywords("");
    setImages([]);
    setMusicFile(null);
    setCurrentProject(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (musicInputRef.current) musicInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen hero-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-12 fade-in">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full glass-effect">
              <Zap className="w-12 h-12 text-blue-400" />
            </div>
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-gradient">
            Super Bundle Creator
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Transform your images into platform-ready bundles with AI-powered SEO optimization, 
            professional formatting, and promotional videos. Create unlimited print-on-demand content in minutes.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Project Setup */}
          <div className="space-y-6 slide-up">
            {/* Project Information */}
            <Card className="glass-effect border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ImageIcon className="w-5 h-5" />
                  Project Details
                </CardTitle>
                <CardDescription>
                  Set up your bundle project with smart SEO optimization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">
                    Project Name *
                  </label>
                  <Input
                    data-testid="project-name-input"
                    placeholder="e.g., Modern Abstract Art Collection"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">
                    Description
                  </label>
                  <Textarea
                    data-testid="project-description-input"
                    placeholder="Brief description for SEO optimization..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">
                    Custom Keywords (comma separated)
                  </label>
                  <Input
                    data-testid="custom-keywords-input"
                    placeholder="digital art, minimalist, commercial use"
                    value={customKeywords}
                    onChange={(e) => setCustomKeywords(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Platform Selection */}
            <Card className="glass-effect border-0">
              <CardHeader>
                <CardTitle className="text-white">Target Platforms</CardTitle>
                <CardDescription>
                  Select platforms for optimized formatting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="platform-grid">
                  {PLATFORM_OPTIONS.map(platform => (
                    <div
                      key={platform.id}
                      data-testid={`platform-${platform.id}`}
                      className={`platform-card ${selectedPlatforms.includes(platform.id) ? 'selected' : ''}`}
                      onClick={() => togglePlatform(platform.id)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${platform.color}`}></div>
                        <span className="font-semibold text-white">{platform.name}</span>
                      </div>
                      <p className="text-sm text-slate-400">{platform.description}</p>
                      {selectedPlatforms.includes(platform.id) && (
                        <CheckCircle className="w-5 h-5 text-blue-400 absolute top-3 right-3" />
                      )}
                    </div>
                  ))}
                </div>
                {selectedPlatforms.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-300">
                      Selected {selectedPlatforms.length} platform(s): {' '}
                      {selectedPlatforms.map(id => 
                        PLATFORM_OPTIONS.find(p => p.id === id)?.name
                      ).join(', ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - File Upload */}
          <div className="space-y-6 slide-up" style={{animationDelay: '0.2s'}}>
            {/* Image Upload */}
            <Card className="glass-effect border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Upload className="w-5 h-5" />
                  Upload Images
                </CardTitle>
                <CardDescription>
                  Drag & drop or click to upload your images
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`upload-zone p-8 text-center cursor-pointer ${
                    dragActive ? 'drag-over' : ''
                  } ${images.length > 0 ? 'has-files' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  data-testid="image-upload-zone"
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                  <h3 className="text-lg font-semibold mb-2 text-white">
                    {images.length > 0 ? `${images.length} images selected` : 'Upload Your Images'}
                  </h3>
                  <p className="text-slate-400 mb-4">
                    PNG, JPG, JPEG formats supported. Multiple files allowed.
                  </p>
                  <Button 
                    variant="outline" 
                    className="btn-secondary"
                    data-testid="select-images-btn"
                  >
                    Select Images
                  </Button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="image-file-input"
                />

                {images.length > 0 && (
                  <div className="image-grid mt-6">
                    {images.map((image) => (
                      <div key={image.id} className="image-preview group">
                        <img 
                          src={image.preview} 
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(image.id);
                          }}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`remove-image-${image.id}`}
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-xs truncate">
                          {image.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Music Upload */}
            <Card className="glass-effect border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Music className="w-5 h-5" />
                  Background Music (Optional)
                </CardTitle>
                <CardDescription>
                  Add music to your promotional video
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => musicInputRef.current?.click()}
                    className="btn-secondary"
                    data-testid="select-music-btn"
                  >
                    <Music className="w-4 h-4 mr-2" />
                    Select Music File
                  </Button>
                  {musicFile && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-500/20 text-green-300">
                        {musicFile.name}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMusicFile(null)}
                        className="text-red-400 hover:text-red-300"
                        data-testid="remove-music-btn"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
                <input
                  ref={musicInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleMusicSelect}
                  className="hidden"
                  data-testid="music-file-input"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <Card className="glass-effect border-0 mt-8 fade-in">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="spinner"></div>
                <div>
                  <h3 className="font-semibold text-white">Creating Your Super Bundle</h3>
                  <p className="text-slate-400 text-sm">
                    {progress < 30 ? 'Generating SEO keywords...' :
                     progress < 50 ? 'Processing images...' :
                     progress < 90 ? 'Creating platform formats...' :
                     'Finalizing bundle...'}
                  </p>
                </div>
              </div>
              <Progress value={progress} className="h-2" data-testid="bundle-progress" />
              <p className="text-sm text-slate-400 mt-2">{progress}% complete</p>
            </CardContent>
          </Card>
        )}

        {/* Create Bundle Button */}
        <div className="text-center mt-12">
          <Button
            onClick={createBundle}
            disabled={isProcessing || !projectName || images.length === 0 || selectedPlatforms.length === 0}
            className="btn-primary text-lg px-12 py-4 glow-effect"
            data-testid="create-bundle-btn"
          >
            {isProcessing ? (
              <>
                <div className="spinner mr-2"></div>
                Creating Bundle...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Create Super Bundle
              </>
            )}
          </Button>
          
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm mb-4">
              Your bundle will include:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">Raw Enhanced Images</Badge>
              <Badge variant="secondary" className="bg-green-500/20 text-green-300">Platform Ready Files</Badge>
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">Mobile/Desktop Wallpapers</Badge>
              <Badge variant="secondary" className="bg-orange-500/20 text-orange-300">Promo Video</Badge>
              <Badge variant="secondary" className="bg-pink-500/20 text-pink-300">Commercial License</Badge>
              <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300">SEO Keywords</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundleCreator;