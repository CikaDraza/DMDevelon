import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Service from '@/models/Service';
import Project from '@/models/Project';
import Testimonial from '@/models/Testimonial';
import CompanyProfile from '@/models/CompanyProfile';
import ContactMessage from '@/models/ContactMessage';
import CMSPage from '@/models/CMSPage';
import { hashPassword, comparePassword, generateToken, getUserFromRequest } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function GET(request, { params }) {
  await connectDB();
  const path = params?.path || [];
  const pathStr = path.join('/');
  const { searchParams } = new URL(request.url);

  try {
    // Health check
    if (pathStr === 'health') {
      return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: getCorsHeaders() });
    }

    // Services
    if (pathStr === 'services') {
      const services = await Service.find().sort({ displayOrder: 1 });
      return NextResponse.json(services, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith('services/')) {
      const id = path[1];
      const service = await Service.findById(id);
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(service, { headers: getCorsHeaders() });
    }

    // Projects
    if (pathStr === 'projects') {
      const category = searchParams.get('category');
      const query = category && category !== 'all' ? { category } : {};
      const projects = await Project.find(query).sort({ createdAt: -1 });
      return NextResponse.json(projects, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith('projects/slug/')) {
      const slug = path[2];
      const project = await Project.findOne({ slug });
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith('projects/')) {
      const id = path[1];
      const project = await Project.findById(id);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    // Testimonials
    if (pathStr === 'testimonials') {
      const testimonials = await Testimonial.find().sort({ createdAt: -1 });
      return NextResponse.json(testimonials, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith('testimonials/')) {
      const id = path[1];
      const testimonial = await Testimonial.findById(id);
      if (!testimonial) {
        return NextResponse.json({ error: 'Testimonial not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(testimonial, { headers: getCorsHeaders() });
    }

    // Company Profile
    if (pathStr === 'company-profile') {
      let profile = await CompanyProfile.findOne();
      if (!profile) {
        profile = await CompanyProfile.create({
          _id: uuidv4(),
          name: 'DMDevelon',
          description: 'Transforming Ideas into Digital Success',
          logo: '',
          heroImage: '',
          phone: '',
          email: 'drazic.milan@gmail.com',
          socialLinks: {},
          seo: { title: 'DMDevelon Portfolio', description: 'Professional web development services', keywords: 'web development, portfolio' },
        });
      }
      return NextResponse.json(profile, { headers: getCorsHeaders() });
    }

    // Contact Messages (admin only)
    if (pathStr === 'contact-messages') {
      const user = getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const messages = await ContactMessage.find().sort({ createdAt: -1 });
      return NextResponse.json(messages, { headers: getCorsHeaders() });
    }

    // CMS Pages
    if (pathStr === 'cms-pages') {
      const pages = await CMSPage.find();
      return NextResponse.json(pages, { headers: getCorsHeaders() });
    }

    if (pathStr.startsWith('cms-pages/slug/')) {
      const slug = path[2];
      const page = await CMSPage.findOne({ slug });
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(page, { headers: getCorsHeaders() });
    }

    // Users (admin only)
    if (pathStr === 'users') {
      const user = getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const users = await User.find().select('-password -resetToken -resetTokenExpiry');
      return NextResponse.json(users, { headers: getCorsHeaders() });
    }

    // User profile
    if (pathStr === 'auth/me') {
      const user = getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const userData = await User.findById(user.userId).select('-password -resetToken -resetTokenExpiry');
      if (!userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(userData, { headers: getCorsHeaders() });
    }

    // Statistics (admin only)
    if (pathStr === 'statistics') {
      const user = getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const [userCount, projectCount, serviceCount, testimonialCount, messageCount] = await Promise.all([
        User.countDocuments(),
        Project.countDocuments(),
        Service.countDocuments(),
        Testimonial.countDocuments(),
        ContactMessage.countDocuments(),
      ]);
      return NextResponse.json({
        users: userCount,
        projects: projectCount,
        services: serviceCount,
        testimonials: testimonialCount,
        messages: messageCount,
      }, { headers: getCorsHeaders() });
    }

    // Categories
    if (pathStr === 'categories') {
      const services = await Service.find().distinct('category');
      const projects = await Project.find().distinct('category');
      const categories = [...new Set([...services, ...projects])];
      return NextResponse.json(categories, { headers: getCorsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: getCorsHeaders() });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function POST(request, { params }) {
  await connectDB();
  const path = params?.path || [];
  const pathStr = path.join('/');

  try {
    const body = await request.json();

    // Auth - Register
    if (pathStr === 'auth/register') {
      const { name, email, password } = body;
      if (!name || !email || !password) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: getCorsHeaders() });
      }
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400, headers: getCorsHeaders() });
      }
      const hashedPassword = hashPassword(password);
      const user = await User.create({
        _id: uuidv4(),
        name,
        email,
        password: hashedPassword,
        isAdmin: false,
      });
      const token = generateToken({ userId: user._id, email: user.email, isAdmin: user.isAdmin });
      return NextResponse.json({
        token,
        user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin },
      }, { headers: getCorsHeaders() });
    }

    // Auth - Login
    if (pathStr === 'auth/login') {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: 'Missing email or password' }, { status: 400, headers: getCorsHeaders() });
      }
      const user = await User.findOne({ email });
      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: getCorsHeaders() });
      }
      const isValid = comparePassword(password, user.password);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: getCorsHeaders() });
      }
      const token = generateToken({ userId: user._id, email: user.email, isAdmin: user.isAdmin });
      return NextResponse.json({
        token,
        user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin, image: user.image },
      }, { headers: getCorsHeaders() });
    }

    // Services (admin only)
    if (pathStr === 'services') {
      const user = getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const service = await Service.create({ _id: uuidv4(), ...body });
      return NextResponse.json(service, { status: 201, headers: getCorsHeaders() });
    }

    // Projects (admin only)
    if (pathStr === 'projects') {
      const user = getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const project = await Project.create({ _id: uuidv4(), ...body, slug });
      return NextResponse.json(project, { status: 201, headers: getCorsHeaders() });
    }

    // Testimonials
    if (pathStr === 'testimonials') {
      const user = getUserFromRequest(request);
      const testimonial = await Testimonial.create({
        _id: uuidv4(),
        ...body,
        userId: user?.userId || null,
      });
      return NextResponse.json(testimonial, { status: 201, headers: getCorsHeaders() });
    }

    // Contact Messages
    if (pathStr === 'contact-messages') {
      const { name, email, message } = body;
      if (!name || !email || !message) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: getCorsHeaders() });
      }
      const contactMessage = await ContactMessage.create({ _id: uuidv4(), name, email, message });
      return NextResponse.json(contactMessage, { status: 201, headers: getCorsHeaders() });
    }

    // CMS Pages (admin only)
    if (pathStr === 'cms-pages') {
      const user = getUserFromRequest(request);
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const page = await CMSPage.create({ _id: uuidv4(), ...body });
      return NextResponse.json(page, { status: 201, headers: getCorsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: getCorsHeaders() });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function PUT(request, { params }) {
  await connectDB();
  const path = params?.path || [];
  const pathStr = path.join('/');

  try {
    const body = await request.json();
    const user = getUserFromRequest(request);

    // Services
    if (pathStr.startsWith('services/')) {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const id = path[1];
      const service = await Service.findByIdAndUpdate(id, body, { new: true });
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(service, { headers: getCorsHeaders() });
    }

    // Projects
    if (pathStr.startsWith('projects/')) {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const id = path[1];
      if (body.title) {
        body.slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
      const project = await Project.findByIdAndUpdate(id, body, { new: true });
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(project, { headers: getCorsHeaders() });
    }

    // Testimonials (admin reply)
    if (pathStr.startsWith('testimonials/')) {
      const id = path[1];
      if (body.adminReply !== undefined) {
        if (!user || !user.isAdmin) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
        }
      }
      const testimonial = await Testimonial.findByIdAndUpdate(id, body, { new: true });
      if (!testimonial) {
        return NextResponse.json({ error: 'Testimonial not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(testimonial, { headers: getCorsHeaders() });
    }

    // Company Profile
    if (pathStr === 'company-profile') {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      let profile = await CompanyProfile.findOne();
      if (profile) {
        profile = await CompanyProfile.findByIdAndUpdate(profile._id, body, { new: true });
      } else {
        profile = await CompanyProfile.create({ _id: uuidv4(), ...body });
      }
      return NextResponse.json(profile, { headers: getCorsHeaders() });
    }

    // Contact Message Reply
    if (pathStr.startsWith('contact-messages/')) {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const id = path[1];
      const message = await ContactMessage.findByIdAndUpdate(id, body, { new: true });
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(message, { headers: getCorsHeaders() });
    }

    // CMS Pages
    if (pathStr.startsWith('cms-pages/')) {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const id = path[1];
      const page = await CMSPage.findByIdAndUpdate(id, body, { new: true });
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(page, { headers: getCorsHeaders() });
    }

    // Users
    if (pathStr.startsWith('users/')) {
      const id = path[1];
      // User can update their own profile, admin can update anyone
      if (!user || (user.userId !== id && !user.isAdmin)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      // Only admin can change isAdmin status
      if (body.isAdmin !== undefined && !user.isAdmin) {
        delete body.isAdmin;
      }
      // Hash password if being updated
      if (body.password) {
        body.password = hashPassword(body.password);
      }
      const updatedUser = await User.findByIdAndUpdate(id, body, { new: true }).select('-password -resetToken -resetTokenExpiry');
      if (!updatedUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json(updatedUser, { headers: getCorsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: getCorsHeaders() });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function DELETE(request, { params }) {
  await connectDB();
  const path = params?.path || [];
  const pathStr = path.join('/');

  try {
    const user = getUserFromRequest(request);

    // Services
    if (pathStr.startsWith('services/')) {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const id = path[1];
      const service = await Service.findByIdAndDelete(id);
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json({ message: 'Service deleted' }, { headers: getCorsHeaders() });
    }

    // Projects
    if (pathStr.startsWith('projects/')) {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const id = path[1];
      const project = await Project.findByIdAndDelete(id);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json({ message: 'Project deleted' }, { headers: getCorsHeaders() });
    }

    // Testimonials
    if (pathStr.startsWith('testimonials/')) {
      const id = path[1];
      const testimonial = await Testimonial.findById(id);
      if (!testimonial) {
        return NextResponse.json({ error: 'Testimonial not found' }, { status: 404, headers: getCorsHeaders() });
      }
      // User can delete their own testimonial, admin can delete any
      if (!user || (testimonial.userId !== user.userId && !user.isAdmin)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      await Testimonial.findByIdAndDelete(id);
      return NextResponse.json({ message: 'Testimonial deleted' }, { headers: getCorsHeaders() });
    }

    // Contact Messages
    if (pathStr.startsWith('contact-messages/')) {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const id = path[1];
      const message = await ContactMessage.findByIdAndDelete(id);
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json({ message: 'Message deleted' }, { headers: getCorsHeaders() });
    }

    // CMS Pages
    if (pathStr.startsWith('cms-pages/')) {
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const id = path[1];
      const page = await CMSPage.findByIdAndDelete(id);
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json({ message: 'Page deleted' }, { headers: getCorsHeaders() });
    }

    // Users
    if (pathStr.startsWith('users/')) {
      const id = path[1];
      // User can delete their own account, admin can delete anyone
      if (!user || (user.userId !== id && !user.isAdmin)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
      }
      const deletedUser = await User.findByIdAndDelete(id);
      if (!deletedUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404, headers: getCorsHeaders() });
      }
      return NextResponse.json({ message: 'User deleted' }, { headers: getCorsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: getCorsHeaders() });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}
