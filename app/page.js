'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServices } from '@/hooks/useServices';
import { useProjects } from '@/hooks/useProjects';
import { useTestimonials } from '@/hooks/useTestimonials';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  Lightbulb,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  ExternalLink,
  Github,
  Code,
  Palette,
  Smartphone,
  Globe,
  TrendingUp,
  Cloud,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  User,
  LogOut,
  LogIn,
  Send,
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  Layers,
  Monitor,
  Database,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Icon mapping
const iconMap = {
  Code,
  Palette,
  Smartphone,
  Globe,
  TrendingUp,
  Cloud,
  Sparkles,
  Zap,
  Shield,
  Layers,
  Monitor,
  Database,
  Settings,
  Mail,
};

// Color mapping
const colorMap = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
  teal: 'bg-teal-500',
};

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -100 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};

const fadeInRight = {
  hidden: { opacity: 0, x: 100 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

const bounceIn = {
  hidden: { opacity: 0, y: -300, scale: 0.3 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      delay: 0.8,
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Profile picture URL
const PROFILE_PICTURE = 'https://res.cloudinary.com/dufo1t5li/image/upload/v1771869893/profile_picture_nmlgdr.png';

// Header Component
function Header({ user, onLoginClick, onLogout }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#hero', label: 'Home' },
    { href: '#services', label: 'Services' },
    { href: '#projects', label: 'Projects' },
    { href: '#testimonials', label: 'Testimonials' },
    { href: '#contact', label: 'Contact' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-[#0f0f10]/90 backdrop-blur-lg shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3">
            <div className="relative">
              <Lightbulb className="w-10 h-10 text-[#FFB633]" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#FFB633] rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="font-logo text-xl font-bold text-white tracking-wider">DMDevelon</h1>
              <p className="text-[10px] text-gray-400 tracking-wide">Transforming Ideas into Digital Success</p>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-300 hover:text-[#FFB633] transition-colors text-sm font-medium"
              >
                {link.label}
              </a>
            ))}
            {user ? (
              <div className="flex items-center gap-4">
                {user.isAdmin && (
                  <a
                    href="/admin"
                    className="text-[#FFB633] hover:text-[#e5a32e] transition-colors text-sm font-medium"
                  >
                    Admin
                  </a>
                )}
                <a
                  href="/dashboard"
                  className="text-gray-300 hover:text-[#FFB633] transition-colors text-sm font-medium"
                >
                  Dashboard
                </a>
                <Button
                  onClick={onLogout}
                  variant="outline"
                  size="sm"
                  className="border-[#FFB633] text-[#FFB633] hover:bg-[#FFB633] hover:text-black"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <Button
                onClick={onLoginClick}
                className="bg-[#FFB633] text-black hover:bg-[#e5a32e]"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login
              </Button>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 pb-4 border-t border-white/10"
            >
              <div className="flex flex-col gap-4 pt-4">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-300 hover:text-[#FFB633] transition-colors text-sm font-medium"
                  >
                    {link.label}
                  </a>
                ))}
                {user ? (
                  <>
                    {user.isAdmin && (
                      <a href="/admin" className="text-[#FFB633] text-sm font-medium">
                        Admin
                      </a>
                    )}
                    <a href="/dashboard" className="text-gray-300 text-sm font-medium">
                      Dashboard
                    </a>
                    <Button
                      onClick={onLogout}
                      variant="outline"
                      size="sm"
                      className="w-fit border-[#FFB633] text-[#FFB633]"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={onLoginClick}
                    className="w-fit bg-[#FFB633] text-black"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

// Hero Section Component
function HeroSection() {
  return (
    <section id="hero" className="section-full relative overflow-hidden pt-20">
      <div className="container mx-auto px-4 h-full">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-0 min-h-[calc(100vh-80px)] items-stretch">
          {/* Left Column */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInLeft}
            className="lg:col-span-3 glass rounded-l-2xl lg:rounded-r-none rounded-t-2xl lg:rounded-t-none lg:rounded-tl-2xl lg:rounded-bl-2xl flex flex-col justify-center p-8 lg:p-12 relative"
          >
            {/* Profile Picture - Top-right corner of left column */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={bounceIn}
              className="absolute right-4 lg:right-6 top-4 lg:top-6 z-20"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[#FFB633] rounded-full blur-3xl opacity-20 animate-pulse" />
                <img
                  src={PROFILE_PICTURE}
                  alt="Milan Drazic"
                  className="rounded-full object-cover relative z-10 shadow-2xl"
                  style={{ width: '14rem', height: '16rem' }}
                />
              </div>
            </motion.div>

            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-[#FFB633] text-sm font-semibold tracking-widest mb-4"
            >
              WELCOME TO MY PORTFOLIO
            </motion.span>
            <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              I'm <span className="text-[#FFB633]">Milan Drazic</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8">
              PR DMDevelon Computer programming and web design
            </p>
            <motion.a
              href="#contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary w-fit flex items-center gap-2"
            >
              Contact me
              <ArrowRight className="w-5 h-5" />
            </motion.a>
          </motion.div>

          {/* Right Column */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInRight}
            className="lg:col-span-4 bg-[#2C2C2C] rounded-r-2xl lg:rounded-l-none rounded-b-2xl lg:rounded-b-none lg:rounded-tr-2xl lg:rounded-br-2xl flex flex-col justify-center p-8 lg:p-12 relative"
          >
            <h2 className="text-3xl lg:text-5xl font-bold text-[#FFB633] mb-6 leading-tight">
              Transforming Ideas into Digital Success
            </h2>
            <p className="text-white text-xl lg:text-2xl font-light">
              Cutting-Edge Web Development and Stunning UI/UX Design
            </p>
          </motion.div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#FFB633]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-[#FFB633]/5 rounded-full blur-3xl" />
    </section>
  );
}

// Services Section Component
function ServicesSection({ services }) {
  // Default services if none in database
  const defaultServices = [
    { _id: '1', title: 'Web Development', description: 'Modern, responsive web applications built with cutting-edge technologies', icon: 'Code', color: 'blue', gridSpan: 2 },
    { _id: '2', title: 'UI/UX Design', description: 'Beautiful, intuitive user interfaces that delight users', icon: 'Palette', color: 'purple', gridSpan: 2 },
    { _id: '3', title: 'Mobile Apps', description: 'Cross-platform mobile applications for iOS and Android', icon: 'Smartphone', color: 'green', gridSpan: 1 },
    { _id: '4', title: 'E-commerce', description: 'Online stores with secure payments and inventory management', icon: 'Globe', color: 'orange', gridSpan: 2 },
    { _id: '5', title: 'Digital Marketing', description: 'SEO, social media, and growth strategies', icon: 'TrendingUp', color: 'pink', gridSpan: 2 },
    { _id: '6', title: 'Cloud Services', description: 'Scalable cloud infrastructure and DevOps', icon: 'Cloud', color: 'cyan', gridSpan: 2 },
    { _id: '7', title: 'API Development', description: 'RESTful APIs and microservices architecture', icon: 'Database', color: 'yellow', gridSpan: 1 },
  ];

  const displayServices = services.length > 0 ? services : defaultServices;

  return (
    <section id="services" className="section-full py-20 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeInUp}
          className="text-center mb-16"
        >
          <span className="text-[#FFB633] text-sm font-semibold tracking-widest">WHAT I DO</span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mt-4">Services</h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
            Comprehensive digital solutions tailored to your business needs
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4"
        >
          {displayServices.map((service, index) => {
            const IconComponent = iconMap[service.icon] || Code;
            const bgColor = colorMap[service.color] || 'bg-blue-500';
            const gridSpan = service.gridSpan || 1;

            return (
              <motion.div
                key={service._id}
                variants={{
                  hidden: { opacity: 0, x: index % 2 === 0 ? -50 : 50, y: 30 },
                  visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.5 } },
                }}
                whileHover={{ scale: 1.03, y: -5 }}
                className={`${bgColor} rounded-2xl p-6 lg:col-span-${Math.min(gridSpan, 7)} transition-all duration-300 cursor-pointer group`}
                style={{
                  gridColumn: `span ${Math.min(gridSpan, 7)}`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{service.title}</h3>
                    <p className="text-white/80 text-sm">{service.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

// Projects Section Component
function ProjectsSection({ projects }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);

  const categories = ['all', ...new Set(projects.map((p) => p.category))];
  const filteredProjects = selectedCategory === 'all' ? projects : projects.filter((p) => p.category === selectedCategory);

  const itemsPerView = 4;
  const maxIndex = Math.max(0, filteredProjects.length - itemsPerView);

  const handlePrev = () => setCurrentIndex((prev) => Math.max(0, prev - 1));
  const handleNext = () => setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));

  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedCategory]);

  // Default projects if none in database
  const defaultProjects = [
    { _id: '1', title: 'E-commerce Platform', category: 'E-commerce', description: 'Full-featured online store', image_url: '', live_preview_url: '#', color: 'blue' },
    { _id: '2', title: 'Mobile Banking App', category: 'Mobile App', description: 'Secure mobile banking solution', image_url: '', live_preview_url: '#', color: 'green' },
    { _id: '3', title: 'Portfolio Website', category: 'Web App', description: 'Creative portfolio showcase', image_url: '', live_preview_url: '#', color: 'purple' },
    { _id: '4', title: 'Marketing Dashboard', category: 'UI/UX Design', description: 'Analytics dashboard design', image_url: '', live_preview_url: '#', color: 'orange' },
  ];

  const displayProjects = filteredProjects.length > 0 ? filteredProjects : defaultProjects;

  return (
    <section id="projects" className="section-full py-20 bg-[#0a0a0b]">
      <div className="container mx-auto px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeInUp}
          className="text-center mb-12"
        >
          <span className="text-[#FFB633] text-sm font-semibold tracking-widest">MY WORK</span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mt-4">Projects</h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
            Explore my recent projects showcasing innovative solutions and creative designs
          </p>
        </motion.div>

        {/* Category Filters */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-[#FFB633] text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {category === 'all' ? 'All Projects' : category}
            </button>
          ))}
        </motion.div>

        {/* Projects Carousel */}
        <div className="relative">
          {/* Navigation Arrows */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-[#FFB633] rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e5a32e] transition-colors -translate-x-1/2 lg:-translate-x-6"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex >= maxIndex}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-[#FFB633] rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e5a32e] transition-colors translate-x-1/2 lg:translate-x-6"
          >
            <ChevronRight className="w-6 h-6 text-black" />
          </button>

          {/* Projects Grid */}
          <div className="overflow-hidden px-8">
            <motion.div
              animate={{ x: -currentIndex * (100 / itemsPerView) + '%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex gap-6"
              style={{ width: `${(displayProjects.length / itemsPerView) * 100}%` }}
            >
              {displayProjects.map((project) => (
                <motion.div
                  key={project._id}
                  whileHover={{ scale: 1.03 }}
                  className={`flex-shrink-0 w-[calc(25%-18px)] min-w-[280px] ${colorMap[project.color] || 'bg-blue-500'} rounded-2xl overflow-hidden group`}
                >
                  <div className="relative h-48 bg-black/20">
                    {project.image_url ? (
                      <img
                        src={project.image_url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Layers className="w-16 h-16 text-white/30" />
                      </div>
                    )}
                    <span className="absolute top-4 right-4 px-3 py-1 bg-black/50 rounded-full text-white text-xs font-medium">
                      {project.category}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2">{project.title}</h3>
                    <p className="text-white/80 text-sm mb-4 line-clamp-2">{project.description}</p>
                    <a
                      href={project.live_preview_url || `/projects/${project.slug || project._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-white font-medium hover:gap-3 transition-all"
                    >
                      Live Preview
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Testimonials Section Component
function TestimonialsSection({ testimonials }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const itemsPerView = 3;
  const maxIndex = Math.max(0, testimonials.length - itemsPerView);

  const handlePrev = () => setCurrentIndex((prev) => Math.max(0, prev - 1));
  const handleNext = () => setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));

  // Default testimonials if none in database
  const defaultTestimonials = [
    { _id: '1', clientName: 'John Smith', clientTitle: 'CEO, TechCorp', rating: 5, comment: 'Exceptional work! The project was delivered on time and exceeded our expectations.', adminReply: '' },
    { _id: '2', clientName: 'Sarah Johnson', clientTitle: 'Marketing Director', rating: 5, comment: 'Milan is a true professional. His attention to detail and creative solutions are outstanding.', adminReply: 'Thank you for your kind words!' },
    { _id: '3', clientName: 'Michael Brown', clientTitle: 'Startup Founder', rating: 4, comment: 'Great communication throughout the project. Would definitely work with again!', adminReply: '' },
  ];

  const displayTestimonials = testimonials.length > 0 ? testimonials : defaultTestimonials;

  return (
    <section id="testimonials" className="section-full py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeInUp}
          className="text-center mb-12"
        >
          <span className="text-[#FFB633] text-sm font-semibold tracking-widest">TESTIMONIALS</span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mt-4">What Clients Say</h2>
        </motion.div>

        {/* Testimonials Carousel */}
        <div className="relative">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-[#FFB633] rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e5a32e] transition-colors -translate-x-1/2 lg:-translate-x-6"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex >= maxIndex}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-[#FFB633] rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e5a32e] transition-colors translate-x-1/2 lg:translate-x-6"
          >
            <ChevronRight className="w-6 h-6 text-black" />
          </button>

          <div className="overflow-hidden px-8">
            <motion.div
              animate={{ x: -currentIndex * (100 / itemsPerView) + '%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex gap-6"
              style={{ width: `${(displayTestimonials.length / itemsPerView) * 100}%` }}
            >
              {displayTestimonials.map((testimonial) => (
                <motion.div
                  key={testimonial._id}
                  whileHover={{ y: -5 }}
                  className="flex-shrink-0 w-[calc(33.333%-16px)] min-w-[300px] glass rounded-2xl p-6"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${i < testimonial.rating ? 'text-[#FFB633] fill-[#FFB633]' : 'text-gray-600'}`}
                      />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-6 italic">"{testimonial.comment}"</p>
                  {testimonial.adminReply && (
                    <div className="bg-[#FFB633]/10 rounded-lg p-3 mb-4 border-l-2 border-[#FFB633]">
                      <p className="text-sm text-gray-400">
                        <span className="text-[#FFB633] font-medium">Reply:</span> {testimonial.adminReply}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#FFB633]/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-[#FFB633]" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{testimonial.clientName}</h4>
                      <p className="text-gray-400 text-sm">{testimonial.clientTitle}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Contact Section Component
function ContactSection() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/contact-messages', formData);
      toast.success('Message sent successfully!');
      setFormData({ name: '', email: '', message: '' });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="section-full py-20 bg-[#0a0a0b]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInLeft}
          >
            <span className="text-[#FFB633] text-sm font-semibold tracking-widest">GET IN TOUCH</span>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mt-4 mb-6">Let's Work Together</h2>
            <p className="text-gray-400 mb-8">
              Have a project in mind? Let's discuss how we can bring your ideas to life with cutting-edge technology and creative solutions.
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#FFB633]/10 rounded-xl">
                  <Mail className="w-6 h-6 text-[#FFB633]" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white">drazic.milan@gmail.com</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#FFB633]/10 rounded-xl">
                  <MapPin className="w-6 h-6 text-[#FFB633]" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Location</p>
                  <p className="text-white">Available Worldwide</p>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-4 mt-8">
              {[Facebook, Twitter, Linkedin, Instagram, Github].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="p-3 bg-white/5 rounded-xl hover:bg-[#FFB633]/20 transition-colors"
                >
                  <Icon className="w-5 h-5 text-gray-400 hover:text-[#FFB633]" />
                </a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInRight}
          >
            <form onSubmit={handleSubmit} className="glass rounded-2xl p-8">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-white mb-2 block">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#FFB633]"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-white mb-2 block">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#FFB633]"
                  />
                </div>
                <div>
                  <Label htmlFor="message" className="text-white mb-2 block">Message</Label>
                  <textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell me about your project..."
                    required
                    rows={5}
                    className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-[#FFB633] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFB633]/20"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e] py-6"
                >
                  {loading ? (
                    'Sending...'
                  ) : (
                    <>
                      Send Message
                      <Send className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Footer Component
function Footer() {
  return (
    <footer className="bg-[#0f0f10] border-t border-white/10 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm">
            Copyright © 2026. DMDevelon. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-gray-400 hover:text-[#FFB633] text-sm transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="text-gray-400 hover:text-[#FFB633] text-sm transition-colors">
              Terms of Service
            </a>
            <a href="/cookies" className="text-gray-400 hover:text-[#FFB633] text-sm transition-colors">
              Cookies
            </a>
          </div>
          <div className="flex gap-4">
            {[Facebook, Twitter, Linkedin, Instagram, Github].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="text-gray-400 hover:text-[#FFB633] transition-colors"
              >
                <Icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// Login Modal Component
function LoginModal({ isOpen, onClose, onLogin, onRegister }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLoginMode) {
        await onLogin(formData.email, formData.password);
      } else {
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }
        await onRegister(formData.name, formData.email, formData.password);
      }
      toast.success(isLoginMode ? 'Login successful!' : 'Registration successful!');
      onClose();
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1b] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {isLoginMode ? 'Welcome Back' : 'Create Account'}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-center">
            {isLoginMode ? 'Sign in to access your dashboard' : 'Register to get started'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {!isLoginMode && (
            <div>
              <Label htmlFor="name" className="text-white">Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
                required={!isLoginMode}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
          )}
          <div>
            <Label htmlFor="loginEmail" className="text-white">Email</Label>
            <Input
              id="loginEmail"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              required
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-white">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
          {!isLoginMode && (
            <div>
              <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                required={!isLoginMode}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FFB633] text-black hover:bg-[#e5a32e] mt-6"
          >
            {loading ? 'Please wait...' : isLoginMode ? 'Sign In' : 'Create Account'}
          </Button>
        </form>
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setIsLoginMode(!isLoginMode)}
            className="text-[#FFB633] hover:underline text-sm"
          >
            {isLoginMode ? "Don't have an account? Register" : 'Already have an account? Sign In'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Page Component
export default function HomePage() {
  const { user, login, register, logout, loading: authLoading } = useAuth();
  const { services, isLoading: servicesLoading } = useServices();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { testimonials, isLoading: testimonialsLoading } = useTestimonials();
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      <Header
        user={user}
        onLoginClick={() => setLoginModalOpen(true)}
        onLogout={logout}
      />
      <HeroSection />
      <ServicesSection services={services} />
      <ProjectsSection projects={projects} />
      <TestimonialsSection testimonials={testimonials} />
      <ContactSection />
      <Footer />
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLogin={login}
        onRegister={register}
      />
    </div>
  );
}
