'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useTestimonials } from '@/hooks/useTestimonials';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  User,
  Briefcase,
  MessageSquare,
  Settings,
  LogOut,
  Lightbulb,
  Star,
  Plus,
  Edit,
  Trash2,
  Home,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Client Dashboard Page
export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, loading, getAuthHeaders } = useAuth();
  const { testimonials, createTestimonial, updateTestimonial, deleteTestimonial } = useTestimonials();
  const [activeTab, setActiveTab] = useState('services');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState(null);
  const [profileData, setProfileData] = useState({ name: '', password: '', confirmPassword: '' });
  const [testimonialData, setTestimonialData] = useState({
    clientName: '',
    clientEmail: '',
    clientTitle: '',
    rating: 5,
    comment: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setProfileData((prev) => ({ ...prev, name: user.name || '' }));
      setTestimonialData((prev) => ({
        ...prev,
        clientName: user.name || '',
        clientEmail: user.email || '',
      }));
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (profileData.password && profileData.password !== profileData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      const updateData = { name: profileData.name };
      if (profileData.password) {
        updateData.password = profileData.password;
      }
      await axios.put(`/api/users/${user.id}`, updateData, { headers: getAuthHeaders() });
      toast.success('Profile updated successfully!');
      setIsProfileModalOpen(false);
      setProfileData({ ...profileData, password: '', confirmPassword: '' });
      // Update local storage
      const updatedUser = { ...user, name: profileData.name };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await axios.delete(`/api/users/${user.id}`, { headers: getAuthHeaders() });
      toast.success('Account deleted successfully');
      logout();
      router.push('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete account');
    }
  };

  const handleSubmitTestimonial = async (e) => {
    e.preventDefault();
    try {
      if (editingTestimonial) {
        await updateTestimonial.mutateAsync({
          id: editingTestimonial._id,
          data: testimonialData,
        });
        toast.success('Testimonial updated successfully!');
      } else {
        await createTestimonial.mutateAsync(testimonialData);
        toast.success('Testimonial submitted successfully!');
      }
      setIsTestimonialModalOpen(false);
      setEditingTestimonial(null);
      setTestimonialData({
        clientName: user?.name || '',
        clientEmail: user?.email || '',
        clientTitle: '',
        rating: 5,
        comment: '',
      });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit testimonial');
    }
  };

  const handleEditTestimonial = (testimonial) => {
    setEditingTestimonial(testimonial);
    setTestimonialData({
      clientName: testimonial.clientName,
      clientEmail: testimonial.clientEmail,
      clientTitle: testimonial.clientTitle || '',
      rating: testimonial.rating,
      comment: testimonial.comment,
    });
    setIsTestimonialModalOpen(true);
  };

  const handleDeleteTestimonial = async (id) => {
    if (confirm('Are you sure you want to delete this testimonial?')) {
      try {
        await deleteTestimonial.mutateAsync(id);
        toast.success('Testimonial deleted successfully!');
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete testimonial');
      }
    }
  };

  // Filter user's testimonials
  const userTestimonials = testimonials.filter(
    (t) => t.clientEmail === user?.email || t.userId === user?.id
  );

  // Mock services data (in a real app, this would come from an orders/subscriptions system)
  const mockServices = [
    {
      id: '1',
      name: 'Web Development',
      description: 'Custom web application development with modern technologies',
      status: 'In Progress',
      estimate: '2-3 weeks',
    },
    {
      id: '2',
      name: 'UI/UX Design',
      description: 'User interface design for your web application',
      status: 'Completed',
      estimate: '1 week',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      {/* Header */}
      <header className="bg-[#1a1a1b] border-b border-white/10 px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-[#FFB633]" />
            <div>
              <h1 className="font-bold text-white">DMDevelon</h1>
              <p className="text-xs text-gray-400">Client Dashboard</p>
            </div>
          </a>
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </a>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-white/20 text-gray-400 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* User Info Card */}
            <div className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10 mb-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#FFB633]/20 flex items-center justify-center mb-4">
                  <User className="w-10 h-10 text-[#FFB633]" />
                </div>
                <h2 className="text-xl font-bold text-white">{user.name}</h2>
                <p className="text-gray-400 text-sm">{user.email}</p>
                <Button
                  onClick={() => setIsProfileModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="mt-4 border-white/20 text-gray-400 hover:text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="bg-[#1a1a1b] rounded-xl p-4 border border-white/10 space-y-2">
              <button
                onClick={() => setActiveTab('services')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'services'
                    ? 'bg-[#FFB633] text-black'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span>My Services</span>
              </button>
              <button
                onClick={() => setActiveTab('testimonials')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'testimonials'
                    ? 'bg-[#FFB633] text-black'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span>Testimonials</span>
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'services' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">My Services</h2>
                <p className="text-gray-400 mb-6">
                  View the services you have requested or are currently using.
                </p>

                {mockServices.length === 0 ? (
                  <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
                    <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">You haven't requested any services yet.</p>
                    <a
                      href="/#services"
                      className="inline-block mt-4 text-[#FFB633] hover:underline"
                    >
                      Browse our services
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mockServices.map((service) => (
                      <motion.div
                        key={service.id}
                        whileHover={{ scale: 1.01 }}
                        className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                            <p className="text-gray-400 text-sm mt-1">{service.description}</p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              service.status === 'Completed'
                                ? 'bg-green-500/20 text-green-400'
                                : service.status === 'In Progress'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {service.status}
                          </span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-gray-500 text-sm">
                            <span className="text-gray-400">Estimated Time:</span> {service.estimate}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'testimonials' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">My Testimonials</h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Share your experience with our services
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingTestimonial(null);
                      setTestimonialData({
                        clientName: user?.name || '',
                        clientEmail: user?.email || '',
                        clientTitle: '',
                        rating: 5,
                        comment: '',
                      });
                      setIsTestimonialModalOpen(true);
                    }}
                    className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Leave Testimonial
                  </Button>
                </div>

                {userTestimonials.length === 0 ? (
                  <div className="text-center py-12 bg-[#1a1a1b] rounded-xl border border-white/10">
                    <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">You haven't left any testimonials yet.</p>
                    <p className="text-gray-500 text-sm mt-2">
                      Share your experience to help others!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userTestimonials.map((testimonial) => (
                      <motion.div
                        key={testimonial._id}
                        whileHover={{ scale: 1.01 }}
                        className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-5 h-5 ${
                                  i < testimonial.rating
                                    ? 'text-[#FFB633] fill-[#FFB633]'
                                    : 'text-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditTestimonial(testimonial)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTestimonial(testimonial._id)}
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
                              <span className="text-[#FFB633] font-medium">Admin Reply:</span>{' '}
                              {testimonial.adminReply}
                            </p>
                          </div>
                        )}
                        <p className="text-gray-500 text-xs mt-4">
                          Posted on {new Date(testimonial.createdAt).toLocaleDateString()}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-12 bg-red-500/5 rounded-xl p-6 border border-red-500/20">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button
            onClick={() => setIsDeleteAccountModalOpen(true)}
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update your profile information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4 mt-4">
            <div>
              <Label className="text-white">Name</Label>
              <Input
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="Your name"
                required
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Email</Label>
              <Input
                value={user?.email || ''}
                disabled
                className="bg-white/5 border-white/10 text-gray-500 mt-1"
              />
              <p className="text-gray-500 text-xs mt-1">Email cannot be changed</p>
            </div>
            <div>
              <Label className="text-white">New Password (optional)</Label>
              <Input
                type="password"
                value={profileData.password}
                onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
                placeholder="Leave blank to keep current"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            {profileData.password && (
              <div>
                <Label className="text-white">Confirm Password</Label>
                <Input
                  type="password"
                  value={profileData.confirmPassword}
                  onChange={(e) =>
                    setProfileData({ ...profileData, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm new password"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            )}
            <Button type="submit" className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Testimonial Modal */}
      <Dialog open={isTestimonialModalOpen} onOpenChange={setIsTestimonialModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTestimonial ? 'Edit Testimonial' : 'Leave a Testimonial'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Share your experience with our services
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTestimonial} className="space-y-4 mt-4">
            <div>
              <Label className="text-white">Your Title/Position</Label>
              <Input
                value={testimonialData.clientTitle}
                onChange={(e) =>
                  setTestimonialData({ ...testimonialData, clientTitle: e.target.value })
                }
                placeholder="e.g., CEO at TechCorp"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Rating</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setTestimonialData({ ...testimonialData, rating })}
                    className="p-1"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        rating <= testimonialData.rating
                          ? 'text-[#FFB633] fill-[#FFB633]'
                          : 'text-gray-600 hover:text-[#FFB633]/50'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-white">Your Testimonial</Label>
              <textarea
                value={testimonialData.comment}
                onChange={(e) =>
                  setTestimonialData({ ...testimonialData, comment: e.target.value })
                }
                placeholder="Share your experience..."
                required
                rows={4}
                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 mt-1"
              />
            </div>
            <Button type="submit" className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e]">
              {editingTestimonial ? 'Update Testimonial' : 'Submit Testimonial'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Modal */}
      <Dialog open={isDeleteAccountModalOpen} onOpenChange={setIsDeleteAccountModalOpen}>
        <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Account</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete your account? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-6">
            <Button
              onClick={() => setIsDeleteAccountModalOpen(false)}
              variant="outline"
              className="flex-1 border-white/20 text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              className="flex-1 bg-red-500 text-white hover:bg-red-600"
            >
              Delete Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
