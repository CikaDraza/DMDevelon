'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/hooks/useServices';
import { useProjects } from '@/hooks/useProjects';
import { useTestimonials } from '@/hooks/useTestimonials';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FolderKanban,
  MessageSquare,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
  Plus,
  Edit,
  Trash2,
  Eye,
  Reply,
  ChevronRight,
  Star,
  Building,
  Mail,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const iconOptions = ['Code', 'Palette', 'Smartphone', 'Globe', 'TrendingUp', 'Cloud', 'Sparkles', 'Zap', 'Shield', 'Layers', 'Monitor', 'Database', 'Settings', 'Mail'];
const colorOptions = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'yellow', 'red', 'indigo', 'teal'];

const colorMap = {
  blue: '#3B82F6',
  green: '#10B981',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
  cyan: '#06B6D4',
  yellow: '#EAB308',
  red: '#EF4444',
  indigo: '#6366F1',
  teal: '#14B8A6',
};

// Sidebar Component
function AdminSidebar({ activeTab, setActiveTab, onLogout, isMobileOpen, setIsMobileOpen }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'services', label: 'Services', icon: Briefcase },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'testimonials', label: 'Testimonials', icon: MessageSquare },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'messages', label: 'Messages', icon: Mail },
    { id: 'company', label: 'Company Profile', icon: Building },
    { id: 'cms', label: 'CMS Pages', icon: FileText },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full bg-[#1a1a1b] border-r border-white/10 z-50 transition-transform duration-300 w-64
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <a href="/" className="flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-[#FFB633]" />
            <div>
              <h1 className="font-bold text-white">DMDevelon</h1>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </a>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${activeTab === item.id ? 'bg-[#FFB633] text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Dashboard Stats Component
function DashboardStats({ stats, isLoading }) {
  if (isLoading) {
    return <div className="text-gray-400">Loading statistics...</div>;
  }

  const chartData = [
    { name: 'Users', value: stats.users || 0, color: '#3B82F6' },
    { name: 'Projects', value: stats.projects || 0, color: '#10B981' },
    { name: 'Services', value: stats.services || 0, color: '#8B5CF6' },
    { name: 'Testimonials', value: stats.testimonials || 0, color: '#F97316' },
    { name: 'Messages', value: stats.messages || 0, color: '#EC4899' },
  ];

  const statCards = [
    { label: 'Total Users', value: stats.users || 0, icon: Users, color: 'bg-blue-500' },
    { label: 'Projects', value: stats.projects || 0, icon: FolderKanban, color: 'bg-green-500' },
    { label: 'Services', value: stats.services || 0, icon: Briefcase, color: 'bg-purple-500' },
    { label: 'Testimonials', value: stats.testimonials || 0, icon: MessageSquare, color: 'bg-orange-500' },
    { label: 'Messages', value: stats.messages || 0, icon: Mail, color: 'bg-pink-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ scale: 1.02 }}
              className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Statistics Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1b', border: '1px solid #333' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="value" fill="#FFB633" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.filter(d => d.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1b', border: '1px solid #333' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-gray-400 text-sm">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Services Management Component
function ServicesManagement() {
  const { services, isLoading, createService, updateService, deleteService } = useServices();
  const { getAuthHeaders } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    icon: 'Code',
    color: 'blue',
    category: '',
    displayOrder: 0,
    gridSpan: 1,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await updateService.mutateAsync({ id: editingService._id, data: formData });
        toast.success('Service updated successfully!');
      } else {
        await createService.mutateAsync(formData);
        toast.success('Service created successfully!');
      }
      setIsModalOpen(false);
      setEditingService(null);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save service');
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      title: service.title,
      description: service.description,
      icon: service.icon || 'Code',
      color: service.color || 'blue',
      category: service.category,
      displayOrder: service.displayOrder || 0,
      gridSpan: service.gridSpan || 1,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this service?')) {
      try {
        await deleteService.mutateAsync(id);
        toast.success('Service deleted successfully!');
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete service');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      icon: 'Code',
      color: 'blue',
      category: '',
      displayOrder: 0,
      gridSpan: 1,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Services Management</h2>
        <Button
          onClick={() => {
            setEditingService(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading services...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
          <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No services yet. Create your first service!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <motion.div
              key={service._id}
              whileHover={{ scale: 1.02 }}
              className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: colorMap[service.color] || '#3B82F6' }}
                >
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service._id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{service.title}</h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{service.description}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                  {service.category}
                </span>
                <span className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                  Grid: {service.gridSpan || 1}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label className="text-white">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Service title"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Description</Label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Service description"
                required
                rows={3}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Icon</Label>
                <Select value={formData.icon} onValueChange={(v) => setFormData({ ...formData, icon: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a2a2b] border-white/10">
                    {iconOptions.map((icon) => (
                      <SelectItem key={icon} value={icon} className="text-white hover:bg-white/10">
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white">Color</Label>
                <Select value={formData.color} onValueChange={(v) => setFormData({ ...formData, color: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a2a2b] border-white/10">
                    {colorOptions.map((color) => (
                      <SelectItem key={color} value={color} className="text-white hover:bg-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: colorMap[color] }} />
                          {color}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-white">Category</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Web Development"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Display Order</Label>
                <Input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Grid Span (1-7)</Label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={formData.gridSpan}
                  onChange={(e) => setFormData({ ...formData, gridSpan: Math.min(7, Math.max(1, parseInt(e.target.value) || 1)) })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]">
              {editingService ? 'Update Service' : 'Create Service'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Projects Management Component
function ProjectsManagement() {
  const { projects, isLoading, createProject, updateProject, deleteProject } = useProjects();
  const { getAuthHeaders } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    logo_url: '',
    live_preview_url: '',
    github_url: '',
    color: 'blue',
    category: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await updateProject.mutateAsync({ id: editingProject._id, data: formData });
        toast.success('Project updated successfully!');
      } else {
        await createProject.mutateAsync(formData);
        toast.success('Project created successfully!');
      }
      setIsModalOpen(false);
      setEditingProject(null);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save project');
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      title: project.title,
      description: project.description,
      image_url: project.image_url || '',
      logo_url: project.logo_url || '',
      live_preview_url: project.live_preview_url || '',
      github_url: project.github_url || '',
      color: project.color || 'blue',
      category: project.category,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject.mutateAsync(id);
        toast.success('Project deleted successfully!');
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete project');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      logo_url: '',
      live_preview_url: '',
      github_url: '',
      color: 'blue',
      category: '',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Projects Management</h2>
        <Button
          onClick={() => {
            setEditingProject(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Project
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
          <FolderKanban className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No projects yet. Create your first project!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <motion.div
              key={project._id}
              whileHover={{ scale: 1.02 }}
              className="bg-[#1a1a1b] rounded-xl overflow-hidden border border-white/10"
            >
              <div
                className="h-32 flex items-center justify-center"
                style={{ backgroundColor: colorMap[project.color] || '#3B82F6' }}
              >
                {project.image_url ? (
                  <img src={project.image_url} alt={project.title} className="w-full h-full object-cover" />
                ) : (
                  <FolderKanban className="w-12 h-12 text-white/50" />
                )}
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(project)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(project._id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{project.description}</p>
                <span className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                  {project.category}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label className="text-white">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Project title"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Description (Markdown supported)</Label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Project description..."
                required
                rows={4}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Category</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., E-commerce, Web App"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Image URL</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Live Preview URL</Label>
                <Input
                  value={formData.live_preview_url}
                  onChange={(e) => setFormData({ ...formData, live_preview_url: e.target.value })}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white">GitHub URL</Label>
                <Input
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                  placeholder="https://github.com/..."
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-white">Color</Label>
              <Select value={formData.color} onValueChange={(v) => setFormData({ ...formData, color: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2a2b] border-white/10">
                  {colorOptions.map((color) => (
                    <SelectItem key={color} value={color} className="text-white hover:bg-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: colorMap[color] }} />
                        {color}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]">
              {editingProject ? 'Update Project' : 'Create Project'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Testimonials Management Component
function TestimonialsManagement() {
  const { testimonials, isLoading, updateTestimonial, deleteTestimonial } = useTestimonials();
  const { getAuthHeaders } = useAuth();
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedTestimonial, setSelectedTestimonial] = useState(null);
  const [replyText, setReplyText] = useState('');

  const handleReply = async () => {
    if (!selectedTestimonial) return;
    try {
      await updateTestimonial.mutateAsync({
        id: selectedTestimonial._id,
        data: { adminReply: replyText },
      });
      toast.success('Reply added successfully!');
      setReplyModalOpen(false);
      setSelectedTestimonial(null);
      setReplyText('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add reply');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this testimonial?')) {
      try {
        await deleteTestimonial.mutateAsync(id);
        toast.success('Testimonial deleted successfully!');
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete testimonial');
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Testimonials Management</h2>

      {isLoading ? (
        <div className="text-gray-400">Loading testimonials...</div>
      ) : testimonials.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No testimonials yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {testimonials.map((testimonial) => (
            <motion.div
              key={testimonial._id}
              whileHover={{ scale: 1.01 }}
              className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#FFB633]/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#FFB633]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{testimonial.clientName}</h3>
                    <p className="text-gray-400 text-sm">{testimonial.clientTitle}</p>
                    <div className="flex gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < testimonial.rating ? 'text-[#FFB633] fill-[#FFB633]' : 'text-gray-600'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedTestimonial(testimonial);
                      setReplyText(testimonial.adminReply || '');
                      setReplyModalOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:text-[#FFB633] hover:bg-[#FFB633]/10 rounded-lg transition-colors"
                  >
                    <Reply className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(testimonial._id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-gray-300 mt-4">"{testimonial.comment}"</p>
              {testimonial.adminReply && (
                <div className="mt-4 p-4 bg-[#FFB633]/10 rounded-lg border-l-2 border-[#FFB633]">
                  <p className="text-sm text-gray-400">
                    <span className="text-[#FFB633] font-medium">Your Reply:</span> {testimonial.adminReply}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      <Dialog open={replyModalOpen} onOpenChange={setReplyModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to Testimonial</DialogTitle>
            <DialogDescription className="text-gray-400">
              Reply to {selectedTestimonial?.clientName}'s testimonial
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-gray-300 text-sm">"{selectedTestimonial?.comment}"</p>
            </div>
            <div>
              <Label className="text-white">Your Reply</Label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your reply..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
              />
            </div>
            <Button onClick={handleReply} className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]">
              {selectedTestimonial?.adminReply ? 'Update Reply' : 'Send Reply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Users Management Component
function UsersManagement() {
  const { getAuthHeaders } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users', { headers: getAuthHeaders() });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAdmin = async (user) => {
    try {
      await axios.put(`/api/users/${user._id}`, { isAdmin: !user.isAdmin }, { headers: getAuthHeaders() });
      toast.success(`User ${user.isAdmin ? 'demoted from' : 'promoted to'} admin!`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`/api/users/${id}`, { headers: getAuthHeaders() });
        toast.success('User deleted successfully!');
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Users Management</h2>

      {isLoading ? (
        <div className="text-gray-400">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No users found.</p>
        </div>
      ) : (
        <div className="bg-[#1a1a1b] rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Joined</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-white/5">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#FFB633]/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#FFB633]" />
                      </div>
                      <span className="text-white font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        user.isAdmin ? 'bg-[#FFB633]/20 text-[#FFB633]' : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {user.isAdmin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                      >
                        {user.isAdmin ? 'Demote' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Messages Management Component
function MessagesManagement() {
  const { getAuthHeaders } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await axios.get('/api/contact-messages', { headers: getAuthHeaders() });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selectedMessage) return;
    try {
      await axios.put(
        `/api/contact-messages/${selectedMessage._id}`,
        { replied: true, replyMessage: replyText },
        { headers: getAuthHeaders() }
      );
      toast.success('Reply sent successfully!');
      setReplyModalOpen(false);
      setSelectedMessage(null);
      setReplyText('');
      fetchMessages();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send reply');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this message?')) {
      try {
        await axios.delete(`/api/contact-messages/${id}`, { headers: getAuthHeaders() });
        toast.success('Message deleted successfully!');
        fetchMessages();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete message');
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Contact Messages</h2>

      {isLoading ? (
        <div className="text-gray-400">Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
          <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No messages yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <motion.div
              key={message._id}
              whileHover={{ scale: 1.01 }}
              className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{message.name}</h3>
                  <p className="text-gray-400 text-sm">{message.email}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {message.replied && (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                      Replied
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSelectedMessage(message);
                      setReplyText(message.replyMessage || '');
                      setReplyModalOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:text-[#FFB633] hover:bg-[#FFB633]/10 rounded-lg transition-colors"
                  >
                    <Reply className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(message._id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-gray-300 mt-4">{message.message}</p>
              {message.replyMessage && (
                <div className="mt-4 p-4 bg-[#FFB633]/10 rounded-lg border-l-2 border-[#FFB633]">
                  <p className="text-sm text-gray-400">
                    <span className="text-[#FFB633] font-medium">Your Reply:</span> {message.replyMessage}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      <Dialog open={replyModalOpen} onOpenChange={setReplyModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to Message</DialogTitle>
            <DialogDescription className="text-gray-400">
              Reply to {selectedMessage?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-gray-300 text-sm">{selectedMessage?.message}</p>
            </div>
            <div>
              <Label className="text-white">Your Reply</Label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your reply..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
              />
            </div>
            <Button onClick={handleReply} className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]">
              Send Reply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Company Profile Management Component
function CompanyProfileManagement() {
  const { getAuthHeaders } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo: '',
    heroImage: '',
    phone: '',
    email: '',
    socialLinks: {
      facebook: '',
      twitter: '',
      linkedin: '',
      instagram: '',
      github: '',
    },
    seo: {
      title: '',
      description: '',
      keywords: '',
    },
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/api/company-profile');
      setProfile(response.data);
      setFormData({
        name: response.data.name || '',
        description: response.data.description || '',
        logo: response.data.logo || '',
        heroImage: response.data.heroImage || '',
        phone: response.data.phone || '',
        email: response.data.email || '',
        socialLinks: response.data.socialLinks || {},
        seo: response.data.seo || {},
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put('/api/company-profile', formData, { headers: getAuthHeaders() });
      toast.success('Company profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    }
  };

  if (isLoading) {
    return <div className="text-gray-400">Loading profile...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Company Profile</h2>

      <form onSubmit={handleSubmit} className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-white">Company Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-white">Description</Label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-white">Logo URL</Label>
            <Input
              value={formData.logo}
              onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white">Phone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Social Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {['facebook', 'twitter', 'linkedin', 'instagram', 'github'].map((social) => (
              <div key={social}>
                <Label className="text-white capitalize">{social}</Label>
                <Input
                  value={formData.socialLinks[social] || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      socialLinks: { ...formData.socialLinks, [social]: e.target.value },
                    })
                  }
                  placeholder={`https://${social}.com/...`}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-4">SEO Settings</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-white">SEO Title</Label>
              <Input
                value={formData.seo.title || ''}
                onChange={(e) =>
                  setFormData({ ...formData, seo: { ...formData.seo, title: e.target.value } })
                }
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">SEO Description</Label>
              <textarea
                value={formData.seo.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, seo: { ...formData.seo, description: e.target.value } })
                }
                rows={2}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
              />
            </div>
            <div>
              <Label className="text-white">SEO Keywords</Label>
              <Input
                value={formData.seo.keywords || ''}
                onChange={(e) =>
                  setFormData({ ...formData, seo: { ...formData.seo, keywords: e.target.value } })
                }
                placeholder="keyword1, keyword2, keyword3"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
          </div>
        </div>

        <Button type="submit" className="bg-[#FFB633] text-black hover:bg-[#e5a32e]">
          Save Changes
        </Button>
      </form>
    </div>
  );
}

// CMS Pages Management Component
function CMSPagesManagement() {
  const { getAuthHeaders } = useAuth();
  const [pages, setPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
  });

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const response = await axios.get('/api/cms-pages');
      setPages(response.data);
    } catch (error) {
      console.error('Failed to fetch pages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPage) {
        await axios.put(`/api/cms-pages/${editingPage._id}`, formData, { headers: getAuthHeaders() });
        toast.success('Page updated successfully!');
      } else {
        await axios.post('/api/cms-pages', formData, { headers: getAuthHeaders() });
        toast.success('Page created successfully!');
      }
      setIsModalOpen(false);
      setEditingPage(null);
      resetForm();
      fetchPages();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save page');
    }
  };

  const handleEdit = (page) => {
    setEditingPage(page);
    setFormData({
      title: page.title,
      slug: page.slug,
      content: page.content,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this page?')) {
      try {
        await axios.delete(`/api/cms-pages/${id}`, { headers: getAuthHeaders() });
        toast.success('Page deleted successfully!');
        fetchPages();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete page');
      }
    }
  };

  const resetForm = () => {
    setFormData({ title: '', slug: '', content: '' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">CMS Pages</h2>
        <Button
          onClick={() => {
            setEditingPage(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Page
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading pages...</div>
      ) : pages.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No CMS pages yet. Create your first page!</p>
        </div>
      ) : (
        <div className="bg-[#1a1a1b] rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Title</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Slug</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Updated</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {pages.map((page) => (
                <tr key={page._id} className="hover:bg-white/5">
                  <td className="px-6 py-4 text-white font-medium">{page.title}</td>
                  <td className="px-6 py-4 text-gray-400">/{page.slug}</td>
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(page.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`/${page.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleEdit(page)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(page._id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage ? 'Edit Page' : 'Add New Page'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label className="text-white">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Page title"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Slug</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="page-slug"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Content (Markdown)</Label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your page content in Markdown..."
                required
                rows={12}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1 font-mono text-sm"
              />
            </div>
            <Button type="submit" className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]">
              {editingPage ? 'Update Page' : 'Create Page'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main Admin Page Component
export default function AdminPage() {
  const router = useRouter();
  const { user, logout, loading, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [stats, setStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.isAdmin) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/statistics', { headers: getAuthHeaders() });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardStats stats={stats} isLoading={statsLoading} />;
      case 'services':
        return <ServicesManagement />;
      case 'projects':
        return <ProjectsManagement />;
      case 'testimonials':
        return <TestimonialsManagement />;
      case 'users':
        return <UsersManagement />;
      case 'messages':
        return <MessagesManagement />;
      case 'company':
        return <CompanyProfileManagement />;
      case 'cms':
        return <CMSPagesManagement />;
      default:
        return <DashboardStats stats={stats} isLoading={statsLoading} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Bar */}
        <header className="bg-[#1a1a1b] border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4 ml-auto">
              <span className="text-gray-400 text-sm">Welcome, {user?.name}</span>
              <div className="w-10 h-10 rounded-full bg-[#FFB633]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#FFB633]" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
