import React, { useState, useEffect } from "react";
import { Package, Download, Clock, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/bundles`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      completed: 'status-completed',
      processing: 'status-processing',
      failed: 'status-failed'
    };
    
    return (
      <Badge className={`status-badge ${variants[status] || 'status-processing'}`}>
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 fade-in">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">Project Dashboard</h1>
            <p className="text-slate-400">Manage your bundle creation projects</p>
          </div>
          <Link to="/">
            <Button className="btn-secondary" data-testid="back-to-creator-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Creator
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 slide-up">
          <Card className="glass-effect border-0">
            <CardContent className="p-6 text-center">
              <Package className="w-8 h-8 mx-auto mb-2 text-blue-400" />
              <h3 className="text-2xl font-bold text-white">{projects.length}</h3>
              <p className="text-slate-400">Total Projects</p>
            </CardContent>
          </Card>
          
          <Card className="glass-effect border-0">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <h3 className="text-2xl font-bold text-white">
                {projects.filter(p => p.status === 'completed').length}
              </h3>
              <p className="text-slate-400">Completed</p>
            </CardContent>
          </Card>
          
          <Card className="glass-effect border-0">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <h3 className="text-2xl font-bold text-white">
                {projects.filter(p => p.status === 'processing').length}
              </h3>
              <p className="text-slate-400">Processing</p>
            </CardContent>
          </Card>
        </div>

        {/* Projects List */}
        {projects.length === 0 ? (
          <Card className="glass-effect border-0 text-center p-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-500" />
            <h3 className="text-xl font-semibold text-white mb-2">No Projects Yet</h3>
            <p className="text-slate-400 mb-6">Create your first bundle to get started</p>
            <Link to="/">
              <Button className="btn-primary" data-testid="create-first-bundle-btn">
                Create Bundle
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4 slide-up" style={{animationDelay: '0.2s'}}>
            {projects.map((project, index) => (
              <Card key={project.id} className="glass-effect border-0 hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white">{project.name}</h3>
                        {getStatusBadge(project.status)}
                      </div>
                      
                      <p className="text-slate-400 mb-4">{project.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.platforms.map((platform) => (
                          <Badge key={platform} variant="outline" className="text-blue-300 border-blue-300/30">
                            {platform.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        ))}
                      </div>
                      
                      {project.seo_keywords && project.seo_keywords.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-slate-400 mb-2">SEO Keywords:</p>
                          <div className="flex flex-wrap gap-1">
                            {project.seo_keywords.slice(0, 5).map((keyword, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs bg-slate-700/50 text-slate-300">
                                {keyword}
                              </Badge>
                            ))}
                            {project.seo_keywords.length > 5 && (
                              <Badge variant="secondary" className="text-xs bg-slate-700/50 text-slate-300">
                                +{project.seo_keywords.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <p className="text-sm text-slate-500">
                        Created: {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {project.status === 'completed' && (
                        <Button 
                          size="sm" 
                          className="btn-primary"
                          data-testid={`download-${project.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;